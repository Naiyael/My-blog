export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export function buildCodeforces(user, history, submissions, now = new Date().toISOString()) {
  const solved = new Map();
  for (const s of submissions) if (s.verdict === 'OK' && !solved.has(`${s.problem.contestId}-${s.problem.index}`)) solved.set(`${s.problem.contestId}-${s.problem.index}`, s);
  const problems = [...solved.values()].map(s => ({id:`${s.problem.contestId}${s.problem.index}`,name:s.problem.name,rating:s.problem.rating??null,tags:s.problem.tags??[],contestId:s.problem.contestId,index:s.problem.index,submissionId:s.id,date:new Date(s.creationTimeSeconds*1000).toISOString().slice(0,10),gym:s.problem.contestId>=100000})).sort((a,b)=>(b.rating??0)-(a.rating??0));
  const tags={}; for(const p of problems)for(const tag of p.tags)tags[tag]=(tags[tag]??0)+1;
  return {handle:user.handle,rating:user.rating??0,maxRating:user.maxRating??0,rank:user.rank??'unrated',totalSubmissions:submissions.length,solved:problems.length,maxDifficulty:Math.max(0,...problems.map(p=>p.rating??0)),history:[...history].sort((a,b)=>a.ratingUpdateTimeSeconds-b.ratingUpdateTimeSeconds),tags,problems,syncedAt:now,recentSubmissions:submissions.slice(0,12).map(s=>({id:s.id,problemId:`${s.problem.contestId}${s.problem.index}`,name:s.problem.name,verdict:s.verdict??'TESTING',language:s.programmingLanguage,date:new Date(s.creationTimeSeconds*1000).toISOString(),url:`https://codeforces.com/${s.problem.contestId>=100000?'gym':'contest'}/${s.problem.contestId}/submission/${s.id}`}))};
}
export async function fetchCodeforces(fetcher=fetch, delay=wait) {
  const get=async path=>{const r=await fetcher('https://codeforces.com/api/'+path,{signal:AbortSignal.timeout(18000)});if(!r.ok)throw new Error('Codeforces unavailable');const j=await r.json();if(j.status!=='OK')throw new Error('Codeforces unavailable');return j.result;};
  const users=await get('user.info?handles=qiushan233');await delay(2100);
  const history=await get('user.rating?handle=qiushan233');await delay(2100);
  const submissions=[];
  for(let from=1;from<=200001;from+=10000){const batch=await get(`user.status?handle=qiushan233&from=${from}&count=10000`);submissions.push(...batch);if(batch.length<10000)break;if(from===200001)throw new Error('Submission pagination limit');await delay(2100);}
  return buildCodeforces(users[0],history,submissions);
}
export const luoguDifficulties=[['未评级','#a4a4a4'],['入门','#ef667b'],['普及−','#e6a14b'],['普及','#d7b641'],['普及+/提高−','#80b86b'],['提高','#55b9b1'],['省选/NOI−','#8b80c9'],['NOI/NOI+/CTSC','#795486']];
function extractLentille(html) {
  if (typeof html !== 'string' || !html) return null;
  const match = html.match(/<script\b[^>]*id=["']lentille-context["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}
function latestLuoguElo(eloList) {
  if (!Array.isArray(eloList) || !eloList.length) return null;
  const latest = eloList.find(e => e?.latest) || [...eloList].sort((a, b) => (b?.time ?? 0) - (a?.time ?? 0))[0];
  return typeof latest?.rating === 'number' ? { rating: latest.rating, contest: latest.contest?.name || '' } : null;
}
function sanitizeDailyCounts(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [date, val] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const count = Array.isArray(val) ? Number(val[0]) : Number(val);
    if (Number.isFinite(count) && count > 0) out[date] = Math.round(count);
  }
  return out;
}
export function parseLuoguProfile(html) {
  const ctx = extractLentille(html);
  const d = ctx?.data;
  if (ctx?.status !== 200 || d?.user?.uid !== 1589332) return null;
  const elo = latestLuoguElo(d.elo);
  return {
    color: typeof d.user?.color === 'string' ? d.user.color : '',
    ranking: typeof d.user?.ranking === 'number' ? d.user.ranking : null,
    gu: typeof d.gu?.rating === 'number' ? d.gu.rating : null,
    elo: elo?.rating ?? null,
    eloContest: elo?.contest ?? '',
    dailyCounts: sanitizeDailyCounts(d.dailyCounts),
  };
}
export function parseLuogu(html, now = new Date().toISOString(), profileHtml = '') {
  const context = extractLentille(html);
  if (!context) throw new Error('Luogu data unavailable');
  const d = context.data;
  if (context.status !== 200 || !Array.isArray(d?.passed) || d?.user?.uid !== 1589332) throw new Error('Luogu practice data unavailable');
  const unique = new Map(d.passed.map(p => [p.pid, p]));
  const problems = [...unique.values()].map(p => { const [group, color] = luoguDifficulties[p.difficulty] ?? luoguDifficulties[0]; return { id: p.pid, name: p.name, group, color, difficulty: p.difficulty }; });
  const groups = luoguDifficulties.map(([name, color], difficulty) => ({ name, color, ids: problems.filter(p => p.difficulty === difficulty).map(p => p.id) })).filter(g => g.ids.length);
  const extra = parseLuoguProfile(profileHtml);
  const fallbackElo = latestLuoguElo(d.elo);
  const profile = {
    color: extra?.color || (typeof d.user?.color === 'string' ? d.user.color : ''),
    ranking: extra?.ranking ?? (typeof d.user?.ranking === 'number' ? d.user.ranking : null),
    gu: extra?.gu ?? null,
    elo: extra?.elo ?? fallbackElo?.rating ?? null,
    eloContest: extra?.eloContest || fallbackElo?.contest || '',
    dailyCounts: extra?.dailyCounts ?? {},
  };
  return { uid: 1589332, handle: d.user.name, solved: problems.length, attempted: new Set([...problems.map(p => p.id), ...(d.submitted ?? []).map(p => p.pid)]).size, problems, groups, profile, syncedAt: now };
}
export async function fetchLuogu(fetcher = fetch) {
  const [practiceRes, profileRes] = await Promise.allSettled([
    fetcher('https://www.luogu.com.cn/user/1589332/practice', { signal: AbortSignal.timeout(18000) }),
    fetcher('https://www.luogu.com.cn/user/1589332', { signal: AbortSignal.timeout(12000) }),
  ]);
  if (practiceRes.status !== 'fulfilled' || !practiceRes.value.ok) throw new Error('Luogu unavailable');
  const practiceHtml = await practiceRes.value.text();
  const profileHtml = profileRes.status === 'fulfilled' && profileRes.value.ok ? await profileRes.value.text().catch(() => '') : '';
  return parseLuogu(practiceHtml, new Date().toISOString(), profileHtml);
}
