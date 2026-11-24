import { Request, Response, NextFunction } from 'express';
import * as Sentry from "@sentry/node";
import { ensureUser } from '../configs/ensureUser.js';


export const protect = async (req: Request, res: Response, next: NextFunction)=>{
    try {
        const {userId} = req.auth()

        if(!userId) {
            return res.status(401).json({message: 'Unauthorized'})
        }
        await ensureUser(userId)
        next()
    } catch (error: any) {
        Sentry.captureException(error)
        res.status(401).json({message: error.code || error.message})
    }
}