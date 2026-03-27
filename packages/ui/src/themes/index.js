import { createTheme } from '@mui/material/styles'

// assets
import colors from '@/assets/scss/_themes-vars.module.scss'

// project imports
import componentStyleOverrides from './compStyleOverride'
import themePalette from './palette'
import themeTypography from './typography'

/**
 * Represent theme style and structure as per Material-UI
 * @param {JsonObject} customization customization parameter object
 */

export const theme = (customization) => {
    const color = colors

    const themeOption = customization.isDarkMode
        ? {
              colors: color,
              heading: color.darkTextTitle,
              paper: color.darkPaper,
              backgroundDefault: color.darkBackground,
              background: color.darkLevel1,
              darkTextPrimary: color.darkTextPrimary,
              darkTextSecondary: color.darkTextSecondary,
              textDark: color.darkTextTitle,
              menuSelected: color.darkSecondaryDark,
              menuSelectedBack: color.darkSecondaryLight,
              divider: color.darkLevel1,
              customization
          }
        : {
              colors: color,
              heading: color.grey900,
              paper: color.paper,
              backgroundDefault: color.grey50,
              background: color.grey100,
              darkTextPrimary: color.grey700,
              darkTextSecondary: color.grey500,
              textDark: color.grey900,
              menuSelected: color.secondaryDark,
              menuSelectedBack: color.secondaryLight,
              divider: color.grey200,
              customization
          }

    const themeOptions = {
        direction: 'ltr',
        palette: themePalette(themeOption),
        mixins: {
            toolbar: {
                minHeight: '48px',
                padding: '16px',
                '@media (min-width: 600px)': {
                    minHeight: '48px'
                }
            }
        },
        typography: themeTypography(themeOption)
    }

    const themes = createTheme(themeOptions)
    themes.components = componentStyleOverrides(themeOption)

    // Ensure theme.customization is always available for styled components and theme-based conditions
    themes.customization = themeOption.customization || customization

    return themes
}

export default theme
