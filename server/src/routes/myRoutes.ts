import { Router } from "express";

import {
  changeMyPasswordController,
  deleteMyDraftController,
  getMyFormByIdController,
  getMyFormsController,
  updateMyFormController
} from "../controllers/myController";
import { authMiddleware } from "../middleware/authMiddleware";

export const myRoutes = Router();

myRoutes.get("/forms", authMiddleware, getMyFormsController);
myRoutes.get("/forms/:id", authMiddleware, getMyFormByIdController);
myRoutes.put("/forms/:id", authMiddleware, updateMyFormController);
myRoutes.delete("/forms/:id", authMiddleware, deleteMyDraftController);
myRoutes.put("/password", authMiddleware, changeMyPasswordController);
