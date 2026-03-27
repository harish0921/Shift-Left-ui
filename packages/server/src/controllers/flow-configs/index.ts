import { Request, Response, NextFunction } from 'express'
import flowConfigsService from '../../services/flow-configs'
import { internalShiftLiftError } from '../../errors/internalShiftLiftError'
import { StatusCodes } from 'http-status-codes'

const getSingleFlowConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (typeof req.params === 'undefined' || !req.params.id) {
            throw new internalShiftLiftError(
                StatusCodes.PRECONDITION_FAILED,
                `Error: flowConfigsController.getSingleFlowConfig - id not provided!`
            )
        }
        const workspaceId = req.user?.activeWorkspaceId
        if (!workspaceId) {
            throw new internalShiftLiftError(
                StatusCodes.NOT_FOUND,
                `Error: flowConfigsController.getSingleFlowConfig - workspace ${workspaceId} not found!`
            )
        }
        const apiResponse = await flowConfigsService.getSingleFlowConfig(req.params.id, workspaceId)
        return res.json(apiResponse)
    } catch (error) {
        next(error)
    }
}

export default {
    getSingleFlowConfig
}

