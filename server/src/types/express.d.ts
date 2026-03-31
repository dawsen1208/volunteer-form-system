declare global {
  namespace Express {
    interface Request {
      user?: {
        userId?: string;
        phone?: string;
        role: "user" | "admin";
      };
    }
  }
}

export {};
