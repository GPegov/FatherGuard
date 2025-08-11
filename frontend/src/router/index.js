import { createRouter, createWebHistory } from "vue-router";
import HomeView from "@/views/HomeView.vue"; // Импорт напрямую для главной страницы


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/review/:id", // Добавляем динамический сегмент
      name: "review",
      component: () => import("@/views/DocumentReview.vue"),
      props: true,
    },
    {
      path: "/documents",
      name: "documents",
      component: () => import("@/views/DocumentsList.vue"), // DocumentsList вместо DocumentsView
    },
    {
      path: "/complaints",
      name: "complaints",
      component: () => import("@/views/ComplaintsList.vue"), // ComplaintsList вместо ComplaintsView
    },
    {
      path: "/documents/:id",
      name: "DocumentDetail",
      component: () => import("@/views/DocumentDetail.vue"),
      props: true,
    },
    {
      path: '/documents/:id/complaint',
      name: 'ComplaintForm',
      component: () => import('@/views/ComplaintForm.vue'),
      props: true
    }

  ],
});

export default router;









