import { Request, Response, NextFunction } from 'express'

const getPing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        return res.status(200).json({ status: 'ok', message: 'pong' })
    } catch (error) {
        next(error)
    }
}

export default {
    getPing
}
