import PropTypes from 'prop-types'
import { Navigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useAuth } from '@/hooks/useAuth'

export const RequireAuth = ({ permission, display, children }) => {
    const disableLogin = import.meta.env.VITE_DISABLE_LOGIN === 'true'
    const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)
    const location = useLocation()
    const { hasPermission, hasDisplay } = useAuth()

    if (disableLogin) {
        return children
    }

    if (!isAuthenticated) {
        return <Navigate to='/signin' state={{ from: location }} replace />
    }

    if (permission && !hasPermission(permission)) {
        return <Navigate to='/unauthorized' replace />
    }

    if (display && !hasDisplay(display)) {
        return <Navigate to='/unauthorized' replace />
    }

    return children
}

RequireAuth.propTypes = {
    permission: PropTypes.string,
    display: PropTypes.string,
    children: PropTypes.node
}
