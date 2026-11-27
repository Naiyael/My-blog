<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { api } from './cms-client';
import StackIcon, { STACK_ICON_PRESETS, isPresetIconKey, suggestIconKey } from './StackIcon.vue';
import { DEFAULT_TECH_STACK, normalizeTechStack } from '../../../../src/site-model.js';
import { reorderNavigation } from '../../../../src/navigation-order.js';

const emit = defineEmits(['dirty-change']);

const items = ref([]);
const version = ref(0);
const ready = ref(false);
const busy = ref(false);
const error = ref('');
const message = ref('');

const draft = ref(null);
const draftBase = ref('');
const dialog = ref(null);
const nameInput = ref(null);
const removing = ref(false);
const iconMode = ref('preset');
const manualIcon = ref(false);

const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== draftBase.value);
const isNew = computed(() => !!draft.value && !items.value.some((item) => item.id === draft.value.id));
const visible = computed(() => items.value.filter((item) => !item.hidden));

watch([dirty, busy], () => emit('dirty-change', dirty.value || busy.value));

const clone = (value) => JSON.parse(JSON.stringify(value));
const newItem = () => ({ id: crypto.randomUUID(), name: '', note: '', icon: 'code', primary: false, hidden: false, link: '' });

function accept(data) {
  items.value = Array.isArray(data.techStack) ? data.techStack : [];
  version.value = data.version ?? 0;
}

async function load() {
  if (busy.value) return;
  busy.value = true;
  try {
    accept(await api('/api/admin/tech-stack'));
    error.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
    ready.value = true;
  }
}

async function persist(candidate, text) {
  if (busy.value) return false;
  let techStack;
  try {
    techStack = normalizeTechStack(candidate);
  } catch (e) {
    error.value = e.message;
    return false;
  }
  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    accept(
      await api('/api/admin/tech-stack', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ techStack, version: version.value }),
      })
    );
    window.dispatchEvent(new Event('site-tech-stack-updated'));
    message.value = text;
    return true;
  } catch (e) {
    error.value = e.message;
    return false;
  } finally {
    busy.value = false;
  }
}

function edit(item = null) {
  if (busy.value) return;
  draft.value = item ? clone(item) : newItem();
  draftBase.value = JSON.stringify(draft.value);
  iconMode.value = isPresetIconKey(draft.value.icon) ? 'preset' : 'custom';
  manualIcon.value = !!item;
  removing.value = false;
  error.value = '';
  nextTick(() => {
    dialog.value?.showModal();
    nameInput.value?.focus();
  });
}

function close(force = false) {
  if (!force && (busy.value || (dirty.value && !window.confirm('常用栈修改尚未保存，确定放弃吗？')))) return;
  dialog.value?.close();
  draft.value = null;
  draftBase.value = '';
  removing.value = false;
  error.value = '';
}

function onNameInput() {
  if (!draft.value || manualIcon.value || iconMode.value !== 'preset') return;
  draft.value.icon = suggestIconKey(draft.value.name);
}

function choosePresetIcon(key) {
  if (!draft.value) return;
  manualIcon.value = true;
  draft.value.icon = key;
}

function switchIconMode(mode) {
  iconMode.value = mode;
  manualIcon.value = true;
  if (!draft.value) return;
  if (mode === 'preset' && !isPresetIconKey(draft.value.icon)) {
    draft.value.icon = suggestIconKey(draft.value.name);
  } else if (mode === 'custom' && isPresetIconKey(draft.value.icon)) {
    draft.value.icon = '';
  }
}

async function saveItem() {
  if (!draft.value || busy.value) return;
  const candidate = clone(items.value);
  const index = candidate.findIndex((item) => item.id === draft.value.id);
  if (index < 0) candidate.push(clone(draft.value));
  else candidate[index] = clone(draft.value);
  if (await persist(candidate, '常用栈已保存，首页侧栏已更新。')) close(true);
}

async function removeItem() {
  if (!draft.value || busy.value) return;
  if (await persist(items.value.filter((item) => item.id !== draft.value.id), '已移除该技术栈项。')) close(true);
}

async function resetDefault() {
  if (busy.value || !window.confirm('确定将常用栈恢复为默认 6 项吗？')) return;
  await persist(clone(DEFAULT_TECH_STACK), '已恢复为默认常用栈。');
}

async function keyboardMove(item, step) {
  if (busy.value) return;
  const index = items.value.findIndex((value) => value.id === item.id);
  const target = items.value[index + step];
  if (!target) return;
  const next = reorderNavigation(items.value, item.id, target.id, step < 0 ? 'before' : 'after');
  await persist(next, '常用栈顺序已自动保存。');
  await nextTick();
  document.querySelector(`[data-stack-card="${item.id}"] .cms-nav-card-main`)?.focus();
}

const drag = ref(null);
const drop = ref(null);
const point = ref({ x: 0, y: 0 });
let pointer = null;
let suppressUntil = 0;
let scrollFrame = 0;

const dragTitle = computed(() => items.value.find((item) => item.id === drag.value?.id)?.name || '未命名项目');
const ghostStyle = computed(() => ({
  left: Math.max(8, Math.min(point.value.x + 14, window.innerWidth - 260)) + 'px',
  top: Math.max(8, Math.min(point.value.y + 14, window.innerHeight - 80)) + 'px',
}));

function startDrag(event, item, handle = false) {
  if (busy.value || event.button !== 0 || (event.pointerType === 'touch' && !handle)) return;
  if (!handle && !event.target.closest('.cms-nav-card-main')) return;
  pointer = {
    id: item.id,
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    element: event.currentTarget.closest('[data-stack-card]'),
  };
}

function updateDrop(x, y) {
  const element = document.elementFromPoint(x, y)?.closest('[data-stack-card]');
  const id = element?.getAttribute('data-stack-card');
  if (!id || id === drag.value.id) {
    drop.value = null;
    return;
  }
  const rect = element.getBoundingClientRect();
  const single = element.parentElement.clientWidth < rect.width * 1.5;
  drop.value = { id, side: (single ? y < rect.top + rect.height / 2 : x < rect.left + rect.width / 2) ? 'before' : 'after' };
}

function scrollDrag() {
  if (!drag.value) {
    scrollFrame = 0;
    return;
  }
  const y = point.value.y;
  if (y < 90 || y > window.innerHeight - 90) {
    window.scrollBy(0, y < 90 ? -12 : 12);
    updateDrop(point.value.x, y);
  }
  scrollFrame = requestAnimationFrame(scrollDrag);
}

function movePointer(event) {
  if (!pointer || event.pointerId !== pointer.pointerId) return;
  if (!drag.value && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 8) return;
  if (!drag.value) {
    drag.value = { id: pointer.id };
    pointer.element.setPointerCapture(event.pointerId);
    document.documentElement.classList.add('cms-card-dragging');
    scrollFrame = requestAnimationFrame(scrollDrag);
  }
  event.preventDefault();
  point.value = { x: event.clientX, y: event.clientY };
  updateDrop(event.clientX, event.clientY);
}

function cancelDrag() {
  if (pointer?.element?.hasPointerCapture(pointer.pointerId)) pointer.element.releasePointerCapture(pointer.pointerId);
  pointer = null;
  drag.value = null;
  drop.value = null;
  cancelAnimationFrame(scrollFrame);
  document.documentElement.classList.remove('cms-card-dragging');
}

async function endPointer(event) {
  if (!pointer || event.pointerId !== pointer.pointerId) return;
  if (!drag.value) {
    cancelDrag();
    return;
  }
  updateDrop(event.clientX, event.clientY);
  const source = drag.value;
  const target = drop.value;
  suppressUntil = Date.now() + 500;
  cancelDrag();
  if (!target) return;
  const next = reorderNavigation(items.value, source.id, target.id, target.side);
  await persist(next, '常用栈顺序已自动保存。');
}

function captureClick(event) {
  if (Date.now() < suppressUntil) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function shortcut(event) {
  if (event.key === 'Escape' && drag.value) {
    event.preventDefault();
    suppressUntil = Date.now() + 500;
    cancelDrag();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (draft.value && !removing.value) saveItem();
    else if (!draft.value) message.value = '拖动后的常用栈顺序会自动保存。';
  }
}

onMounted(() => {
  load();
  window.addEventListener('keydown', shortcut);
  document.addEventListener('pointermove', movePointer, { passive: false });
  document.addEventListener('pointerup', endPointer);
  document.addEventListener('pointercancel', cancelDrag);
});

onUnmounted(() => {
  cancelDrag();
  emit('dirty-change', false);
  window.removeEventListener('keydown', shortcut);
  document.removeEventListener('pointermove', movePointer);
  document.removeEventListener('pointerup', endPointer);
  document.removeEventListener('pointercancel', cancelDrag);
});
</script>

<template>
<section class="cms-navigation-library cms-stack-library">
  <header class="cms-nav-library-heading">
    <div>
      <h2>常用栈 <small>{{ items.length }} 项</small></h2>
      <p>管理首页左侧栏展示的语言与工具徽章，拖动卡片调整顺序 · 松手自动保存。</p>
    </div>
    <div class="cms-stack-head-actions">
      <button @click="resetDefault" :disabled="busy">恢复默认</button>
      <button @click="load" :disabled="busy">{{ busy ? '保存 / 加载中…' : '刷新' }}</button>
    </div>
  </header>

  <p v-if="error && !draft" class="cms-error cms-notification" role="alert">{{ error }}</p>
  <p v-if="message && !draft" class="cms-notification" role="status">✓ {{ message }}</p>
  <p v-if="!ready" class="cms-muted">正在加载常用栈…</p>

  <template v-else>
    <div class="cms-nav-live-preview cms-stack-preview">
      <span>侧栏预览</span>
      <div class="cms-stack-preview-chips" aria-label="首页侧栏常用栈预览">
        <button
          v-for="item in visible"
          :key="item.id"
          type="button"
          class="stack-chip"
          :class="{ 'is-primary': item.primary }"
          @click="edit(item)"
          :title="item.note ? `${item.name} · ${item.note}` : item.name"
        >
          <StackIcon :icon="item.icon" :name="item.name" />
          <span>{{ item.name }}</span>
        </button>
        <em v-if="!visible.length">所有项目已隐藏，首页将不显示常用栈卡片</em>
      </div>
    </div>

    <p class="cms-sr-only" id="stack-card-help">点击编辑；拖动排序，或使用 Alt 加上下方向键。顺序自动保存。</p>

    <div class="cms-nav-card-grid">
      <button
        class="cms-create-card cms-nav-create"
        @click="edit()"
        :disabled="busy || items.length >= 16"
        aria-label="新增常用栈"
      >
        <span class="cms-create-plus" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 4.5v11M4.5 10h11"/></svg>
        </span>
        <strong>添加常用栈</strong>
        <span>{{ items.length >= 16 ? '已达到 16 项上限' : '语言、编辑器或开发工具' }}</span>
      </button>

      <article
        v-for="(item, index) in items"
        :key="item.id"
        class="cms-nav-card cms-stack-card"
        :data-stack-card="item.id"
        :class="{
          'is-hidden': item.hidden,
          'is-pinned': item.primary,
          'is-dragging': drag?.id === item.id,
          'is-drop-before': drop?.id === item.id && drop.side === 'before',
          'is-drop-after': drop?.id === item.id && drop.side === 'after',
        }"
        @pointerdown="startDrag($event, item)"
        @click.capture="captureClick"
        @dragstart.prevent
        @keydown.alt.up.prevent="keyboardMove(item, -1)"
        @keydown.alt.down.prevent="keyboardMove(item, 1)"
      >
        <button
          class="cms-nav-card-main"
          @click="edit(item)"
          :disabled="busy"
          :aria-label="'编辑常用栈：' + item.name"
          aria-describedby="stack-card-help"
        >
          <span class="cms-nav-card-meta has-grip">
            <span>{{ item.primary ? '主力高亮' : '常用工具' }}</span>
            <span>{{ item.hidden ? '已隐藏' : String(index + 1).padStart(2, '0') }}</span>
          </span>
          <div class="cms-stack-card-title">
            <span class="cms-stack-icon-box"><StackIcon :icon="item.icon" :name="item.name" /></span>
            <strong>{{ item.name }}</strong>
          </div>
          <span class="cms-nav-card-url">{{ item.note || '未填写备注说明' }}</span>
          <span class="cms-card-bottom">
            <span class="cms-nav-card-sub">{{ item.link ? '已配置跳转链接' : '' }}</span>
            <span class="cms-card-edit-hint" aria-hidden="true">
              编辑<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg>
            </span>
          </span>
        </button>

        <button
          class="cms-card-grip"
          @pointerdown.stop.prevent="startDrag($event, item, true)"
          @click.stop="message = '按住卡片或右上角手柄拖动排序，也支持 Alt + 上下方向键；松手自动保存。'"
          :disabled="busy"
          :aria-label="'拖动常用栈：' + item.name"
          title="按住拖动排序"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="5.5" cy="3.5" r="1.25"/><circle cx="10.5" cy="3.5" r="1.25"/>
            <circle cx="5.5" cy="8" r="1.25"/><circle cx="10.5" cy="8" r="1.25"/>
            <circle cx="5.5" cy="12.5" r="1.25"/><circle cx="10.5" cy="12.5" r="1.25"/>
          </svg>
        </button>
      </article>
    </div>
  </template>

  <dialog
    v-if="draft"
    ref="dialog"
    class="cms-edit-dialog cms-nav-edit-dialog"
    aria-labelledby="stack-edit-title"
    @cancel.prevent="close()"
    @click.self="close()"
  >
    <div class="cms-nav-edit-body">
      <header class="cms-dialog-heading">
        <div>
          <span class="cms-eyebrow">TECH STACK</span>
          <h2 id="stack-edit-title">{{ isNew ? '添加常用栈' : '编辑常用栈' }}</h2>
        </div>
        <button class="cms-dialog-close" @click="close()" :disabled="busy" aria-label="关闭常用栈编辑">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m4.5 4.5 7 7M11.5 4.5l-7 7"/></svg>
        </button>
      </header>
      <p class="cms-nav-editor-note">设置名称、图标与展示样式，保存后首页左侧栏实时生效。</p>
      <p v-if="error" class="cms-error cms-notification" role="alert">{{ error }}</p>

      <div v-if="removing" class="cms-confirm" role="alertdialog" aria-labelledby="stack-remove-title">
        <h2 id="stack-remove-title">移除“{{ draft.name }}”？</h2>
        <p>将从首页常用栈卡片中移除该项。</p>
        <div>
          <button @click="removing = false" :disabled="busy">取消</button>
          <button class="cms-danger" @click="removeItem" :disabled="busy">确认移除</button>
        </div>
      </div>

      <fieldset class="cms-fields" :disabled="busy || removing">
        <div class="cms-field-row">
          <label class="cms-field">
            <span>名称</span>
            <input ref="nameInput" v-model="draft.name" @input="onNameInput" maxlength="24" placeholder="例如：C++、CLion、Rust" aria-label="技术栈名称" />
          </label>
          <label class="cms-field">
            <span>备注说明 <small>可选，悬停显示</small></span>
            <input v-model="draft.note" maxlength="40" placeholder="例如：主力 · 算法竞赛" aria-label="技术栈备注" />
          </label>
        </div>

        <label class="cms-pin-setting">
          <span><strong>显示在首页侧栏</strong><small>关闭后保留配置，访客看不到此徽章。</small></span>
          <input type="checkbox" role="switch" :checked="!draft.hidden" @change="draft.hidden = !$event.target.checked" aria-label="显示在首页侧栏" />
        </label>

        <label class="cms-pin-setting">
          <span><strong>标记为主力高亮</strong><small>开启后徽章带淡青高亮强调，适合主力编程语言。</small></span>
          <input type="checkbox" role="switch" v-model="draft.primary" aria-label="标记为主力高亮" />
        </label>

        <div class="cms-field">
          <div class="cms-stack-icon-head">
            <span>图标</span>
            <div class="cms-stack-mode-tabs">
              <button type="button" :class="{ active: iconMode === 'preset' }" @click="switchIconMode('preset')">内置图标</button>
              <button type="button" :class="{ active: iconMode === 'custom' }" @click="switchIconMode('custom')">自定义链接</button>
            </div>
          </div>

          <div v-if="iconMode === 'preset'" class="cms-icon-picker" role="radiogroup" aria-label="选择内置图标">
            <button
              v-for="preset in STACK_ICON_PRESETS"
              :key="preset.key"
              type="button"
              class="cms-icon-option"
              :class="{ 'is-selected': draft.icon === preset.key }"
              :aria-checked="draft.icon === preset.key"
              role="radio"
              @click="choosePresetIcon(preset.key)"
            >
              <StackIcon :icon="preset.key" :name="preset.label" />
              <span>{{ preset.label }}</span>
            </button>
          </div>
          <div v-else class="cms-stack-custom-icon">
            <span class="cms-stack-icon-box"><StackIcon :icon="draft.icon" :name="draft.name" /></span>
            <input
              v-model.trim="draft.icon"
              type="url"
              maxlength="500"
              placeholder="https://example.com/icon.svg 或 /images/icon.png"
              aria-label="自定义图标链接"
            />
          </div>
        </div>

        <label class="cms-field">
          <span>点击跳转链接 <small>可选，留空仅作展示</small></span>
          <input v-model.trim="draft.link" maxlength="500" placeholder="/codeforces.html 或 https://github.com/..." aria-label="跳转链接" />
        </label>
      </fieldset>

      <footer class="cms-nav-edit-footer">
        <button v-if="!isNew" class="cms-danger-text" @click="removing = true" :disabled="busy || removing">移除此项</button>
        <span v-else>最多可添加 16 项，支持拖拽调整顺序。</span>
        <div>
          <button @click="close()" :disabled="busy">取消</button>
          <button class="cms-primary" @click="saveItem" :disabled="busy || removing">{{ busy ? '保存中…' : '保存常用栈' }}</button>
        </div>
      </footer>
    </div>
  </dialog>

  <Teleport to="body">
    <div v-if="drag" class="cms-card-drag-ghost" :style="ghostStyle" aria-hidden="true">
      <svg class="ui-grip-icon" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="5.5" cy="3.5" r="1.25"/><circle cx="10.5" cy="3.5" r="1.25"/>
        <circle cx="5.5" cy="8" r="1.25"/><circle cx="10.5" cy="8" r="1.25"/>
        <circle cx="5.5" cy="12.5" r="1.25"/><circle cx="10.5" cy="12.5" r="1.25"/>
      </svg>
      <div><strong>{{ dragTitle }}</strong><small>松手，自动保存顺序</small></div>
    </div>
  </Teleport>
</section>
</template>
