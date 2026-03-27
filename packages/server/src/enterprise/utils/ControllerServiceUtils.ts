import { Equal } from 'typeorm'
import { Request } from 'express'
import { internalShiftLiftError } from '../../errors/internalShiftLiftError'
import { StatusCodes } from 'http-status-codes'

export const getWorkspaceSearchOptions = (workspaceId?: string) => {
    if (!workspaceId) {
        return {}
    }
    return { workspaceId: Equal(workspaceId) }
}

export const getWorkspaceSearchOptionsFromReq = (req: Request) => {
    const workspaceId = req.user?.activeWorkspaceId
    if (!workspaceId) {
        return {}
    }
    return { workspaceId: Equal(workspaceId) }
}

