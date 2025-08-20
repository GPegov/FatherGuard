import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/views/HomeView.vue"),
    },
    {
      path: "/review/:id",
      name: "review",
      component: () => import("@/views/DocumentReview.vue"),
      props: true,
    },
    {
      path: "/documents",
      name: "documents",
      component: () => import("@/views/DocumentsList.vue"),
    },
    {
      path: "/complaints",
      name: "complaints",
      component: () => import("@/views/ComplaintsList.vue"),
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
    },
    {
      path: '/complaints/:id',
      name: 'ComplaintDetail',
      component: () => import('@/views/ComplaintDetail.vue'),
      props: true
    }
  ],
});

export default router;









