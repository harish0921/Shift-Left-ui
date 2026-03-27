import { Box, Typography } from '@mui/material'
import shiftLiftMark from '@/assets/images/shiftlift-mark.svg'

// ==============================|| LOGO ||============================== //

const Logo = () => {
    return (
        <Box sx={{ alignItems: 'center', display: 'flex', flexDirection: 'row', gap: 1, ml: 1 }}>
            <img style={{ objectFit: 'contain', height: 30, width: 30, display: 'block' }} src={shiftLiftMark} alt='Shift Left' />
            <Typography
                variant='h5'
                sx={{
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    lineHeight: 1,
                    color: '#1A1A1A'
                }}
            >
                Shift
                <Box component='span' sx={{ color: '#0078D4', fontWeight: 600 }}>
                    Left
                </Box>
            </Typography>
        </Box>
    )
}

export default Logo
