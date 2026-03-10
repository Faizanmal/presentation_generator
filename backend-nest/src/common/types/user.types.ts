import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}
