import { Router } from "express";

import {
  deleteFormByIdForAdminController,
  getAllFormsController,
  getFormByIdForAdminController,
  getUserPasswordForAdminController,
  loginAdminController
} from "../controllers/adminController";
import { adminOnly } from "../middleware/adminOnly";
import { authMiddleware } from "../middleware/authMiddleware";

export const adminRoutes = Router();

adminRoutes.post("/login", loginAdminController);
adminRoutes.get("/forms", authMiddleware, adminOnly, getAllFormsController);
adminRoutes.get("/forms/:id", authMiddleware, adminOnly, getFormByIdForAdminController);
adminRoutes.delete("/forms/:id", authMiddleware, adminOnly, deleteFormByIdForAdminController);
adminRoutes.post("/user-password", authMiddleware, adminOnly, getUserPasswordForAdminController);
