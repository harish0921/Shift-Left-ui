import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet } from 'react-router-dom'

// material-ui
import { styled, useTheme } from '@mui/material/styles'
import { AppBar, Box, CssBaseline, Toolbar, useMediaQuery } from '@mui/material'

// project imports
import Header from './Header'
import Sidebar from './Sidebar'
import { drawerWidth, headerHeight } from '@/store/constant'
import { SET_MENU } from '@/store/actions'

// styles
const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
    ...theme.typography.mainContent,
    boxShadow:
        theme?.customization?.isDarkMode
            ? '0 12px 40px rgba(0,0,0,0.35)'
            : '0 18px 40px rgba(55, 33, 20, 0.08)',
    border: `1px solid ${theme.palette.divider}`,
    ...(!open && {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        transition: theme.transitions.create('all', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen
        }),
        marginRight: 0,
        [theme.breakpoints.up('md')]: {
            marginLeft: -drawerWidth,
            width: `calc(100% - ${drawerWidth}px)`
        },
        [theme.breakpoints.down('md')]: {
            marginLeft: '20px',
            width: `calc(100% - ${drawerWidth}px)`,
            padding: '20px'
        },
        [theme.breakpoints.down('sm')]: {
            marginLeft: '12px',
            width: `calc(100% - ${drawerWidth}px)`,
            padding: '16px',
            marginRight: '12px'
        }
    }),
    ...(open && {
        transition: theme.transitions.create('all', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen
        }),
        marginLeft: 0,
        marginRight: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        width: `calc(100% - ${drawerWidth}px)`
    })
}))

// ==============================|| MAIN LAYOUT ||============================== //

const MainLayout = () => {
    const theme = useTheme()
    const matchDownMd = useMediaQuery(theme.breakpoints.down('lg'))

    // Handle left drawer
    const customization = useSelector((state) => state.customization)
    const leftDrawerOpened = customization.opened
    const dispatch = useDispatch()
    const handleLeftDrawerToggle = () => {
        dispatch({ type: SET_MENU, opened: !leftDrawerOpened })
    }

    useEffect(() => {
        setTimeout(() => dispatch({ type: SET_MENU, opened: !matchDownMd }), 0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchDownMd])

    return (
        <Box
            sx={{
                display: 'flex',
                minHeight: '100vh',
                background: customization.isDarkMode
                    ? 'linear-gradient(180deg, rgba(20,18,16,1) 0%, rgba(24,22,20,1) 60%, rgba(18,16,14,1) 100%)'
                    : 'linear-gradient(180deg, #f7f2ec 0%, #f2ece4 50%, #efe7de 100%)'
            }}
        >
            <CssBaseline />
            {/* header */}
            <AppBar
                enableColorOnDark
                position='fixed'
                color='inherit'
                elevation={0}
                sx={{
                    bgcolor: theme.palette.background.paper,
                    transition: leftDrawerOpened ? theme.transitions.create('width') : 'none'
                }}
            >
                <Toolbar
                    sx={{
                        height: `${headerHeight}px`,
                        borderBottom: '1px solid',
                        borderColor: theme.palette.divider
                    }}
                >
                    <Header handleLeftDrawerToggle={handleLeftDrawerToggle} />
                </Toolbar>
            </AppBar>

            {/* drawer */}
            <Sidebar drawerOpen={leftDrawerOpened} drawerToggle={handleLeftDrawerToggle} />

            {/* main content */}
            <Main theme={theme} open={leftDrawerOpened}>
                <Outlet />
            </Main>
        </Box>
    )
}

export default MainLayout
