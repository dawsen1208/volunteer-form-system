import { Router } from "express";

import {
  getAllFormsController,
  getFormByIdForAdminController,
  loginAdminController
} from "../controllers/adminController";
import { adminOnly } from "../middleware/adminOnly";
import { authMiddleware } from "../middleware/authMiddleware";

export const adminRoutes = Router();

adminRoutes.post("/login", loginAdminController);
adminRoutes.get("/forms", authMiddleware, adminOnly, getAllFormsController);
adminRoutes.get("/forms/:id", authMiddleware, adminOnly, getFormByIdForAdminController);
