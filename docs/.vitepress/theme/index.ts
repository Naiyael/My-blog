import Teek from 'vitepress-theme-teek';
import 'vitepress-theme-teek/index.css';
import './custom.css';
import RatingHistory from './components/RatingHistory.vue';
import ProblemArchive from './components/ProblemArchive.vue';
export default {
  extends: Teek,
  enhanceApp({ app }) {
    app.component('RatingHistory', RatingHistory);
    app.component('ProblemArchive', ProblemArchive);
  },
};
