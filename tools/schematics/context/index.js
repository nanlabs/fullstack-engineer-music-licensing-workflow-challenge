const {
  renameTemplateFiles,
  mergeWith,
  template,
  filter,
  apply,
  chain,
  move,
  url,
} = require('@angular-devkit/schematics')
const { strings } = require('@angular-devkit/core')

/**
 * @param {{ name: string, application?: boolean, domain?: boolean, infrastructure?: boolean }} options
 */
function context(options) {
  return (tree, _context) => {
    const { name, application, domain, controllers, repositories } = options

    const rules = []

    const sourceTemplates = url('./files')

    // Generate application folder
    if (application) {
      const appTemplates = apply(sourceTemplates, [
        template({ ...options, ...strings }),
        renameTemplateFiles(),
        filter(path => path.includes('/application/')),
        move(`src/contexts/${strings.dasherize(name)}/application`),
      ])
      rules.push(mergeWith(appTemplates))
    }

    // Generate domain folder
    if (domain) {
      const domainTemplates = apply(sourceTemplates, [
        template({ ...options, ...strings }),
        renameTemplateFiles(),
        filter(path => path.includes('/domain/')),
        move(`src/contexts/${strings.dasherize(name)}/domain`),
      ])
      rules.push(mergeWith(domainTemplates))
    }

    // Generate infrastructure folder
    if (controllers) {
      const infraTemplates = apply(sourceTemplates, [
        template({ ...options, ...strings }),
        renameTemplateFiles(),
        filter(path => path.includes('/infrastructure/controllers')),
        move(
          `src/contexts/${strings.dasherize(name)}/infrastructure/controllers`,
        ),
      ])
      rules.push(mergeWith(infraTemplates))
    }

    if (repositories) {
      const infraTemplates = apply(sourceTemplates, [
        template({ ...options, ...strings }),
        renameTemplateFiles(),
        filter(path => path.includes('/infrastructure/repositories')),
        move(
          `src/contexts/${strings.dasherize(name)}/infrastructure/repositories`,
        ),
      ])
      rules.push(mergeWith(infraTemplates))
    }

    // If no flags provided, generate everything
    if (!application && !domain && !controllers && !repositories) {
      const fullTemplates = apply(sourceTemplates, [
        template({ ...options, ...strings }),
        renameTemplateFiles(),
        move(`src/contexts/${strings.dasherize(name)}`),
      ])
      rules.push(mergeWith(fullTemplates))
    }

    return chain(rules)(tree, _context)
  }
}

module.exports = { context }
