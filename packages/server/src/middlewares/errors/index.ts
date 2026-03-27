import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { internalShiftLiftError } from '../../errors/internalShiftLiftError'

// we need eslint because we have to pass next arg for the error middleware
// eslint-disable-next-line
async function errorHandlerMiddleware(err: internalShiftLiftError, req: Request, res: Response, next: NextFunction) {
    const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR
    if (err.message.includes('401 Incorrect API key provided'))
        err.message = '401 Unauthorized – check your API key and ensure it has access to the requested model.'
    let displayedError = {
        statusCode,
        success: false,
        message: err.message,
        // Provide error stack trace only in development
        stack: process.env.NODE_ENV === 'development' ? err.stack : {}
    }

    if (!req.body || !req.body.streaming || req.body.streaming === 'false') {
        res.setHeader('Content-Type', 'application/json')
        res.status(displayedError.statusCode).json(displayedError)
    }
}

export default errorHandlerMiddleware

