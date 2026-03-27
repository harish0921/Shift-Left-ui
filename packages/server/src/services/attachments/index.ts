import { Request } from 'express'
import { StatusCodes } from 'http-status-codes'
import { createFileAttachment } from '../../utils/createAttachment'
import { internalShiftLiftError } from '../../errors/internalShiftLiftError'
import { getErrorMessage } from '../../errors/utils'

const createAttachment = async (req: Request) => {
    try {
        return await createFileAttachment(req)
    } catch (error) {
        throw new internalShiftLiftError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            `Error: attachmentService.createAttachment - ${getErrorMessage(error)}`
        )
    }
}

export default {
    createAttachment
}

