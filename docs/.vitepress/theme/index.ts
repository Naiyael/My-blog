import Teek from 'vitepress-theme-teek';
import 'vitepress-theme-teek/index.css';
import './custom.css';
import './cms.css';
import Layout from './Layout.vue';
import RatingHistory from './components/RatingHistory.vue';
import ProblemArchive from './components/ProblemArchive.vue';
import AdminPanel from './components/AdminPanel.vue';
import PublishedPosts from './components/PublishedPosts.vue';
import PostView from './components/PostView.vue';
import PlatformSummary from './components/PlatformSummary.vue';
import RecentSubmissions from './components/RecentSubmissions.vue';
import ManagedPage from './components/ManagedPage.vue';
export default {
  extends: Teek,
  Layout,
  enhanceApp({ app }) {
    app.component('RatingHistory', RatingHistory);
    app.component('ProblemArchive', ProblemArchive);
    app.component('AdminPanel', AdminPanel);
    app.component('PublishedPosts', PublishedPosts);
    app.component('PostView', PostView);
    app.component('PlatformSummary', PlatformSummary);
    app.component('RecentSubmissions', RecentSubmissions);
    app.component('ManagedPage', ManagedPage);
  },
};
