import { join, extname, basename, resolve } from 'path'
import { Api, InternalApi } from '@yandex/themekit'
import { createStyleDictionaryConfig } from '@yandex/themekit/lib/core/style-dictionary-config'
import cssColorFn from 'css-color-function'
import { readFileSync, writeFileSync } from 'fs'

import { glob } from './glob'
import { mockFile } from './mockFile'

export { version } from '@yandex/themekit/package.json'

// Extends themekit module with internal API.
declare module '@yandex/themekit' {
  export const InternalApi: any
}

type Result = {
  content: string
  fileName: string
  language: string
}

/**
 * Runs themekit build with mocked fs.
 *
 * @param config - Themekit config
 * @param tokens - Tokens object
 * @param mappings - Mappings object
 */
export async function buildThemekit(
  config: any,
  tokens: any,
  mappings: Record<string, string> = {},
): Promise<Result[]> {
  mockFile('tokens.json', JSON.stringify(tokens))

  Api.registerAction({
    name: 'process-color',
    do: (_, config) => {
      for (const file of config.files) {
        const filePath = resolve(process.cwd(), config.buildPath, file.destination)
        const colorRe = /color\(.+\)/g
        let content = readFileSync(filePath, 'utf8')
        let executed = null
        while ((executed = colorRe.exec(content)) !== null) {
          content = content.replace(executed[0], cssColorFn.convert(executed[0]))
        }
        writeFileSync(filePath, content)
      }
    },
    undo: () => {},
  })

  // TODO: Register this format in themekit.
  Api.registerFormat({
    name: 'json/extended',
    formatter(dictionary) {
      const result: Record<string, any> = {}
      for (const prop of dictionary.allProperties) {
        result[prop.name] = {
          name: prop.name,
          value: prop.value,
          path: prop.path,
          comment: prop.comment,
          rawValue: prop.original.value,
        }
      }
      return JSON.stringify(result, null, 2)
    },
  })

  Api.registerTransform({
    name: 'json/extended/mapper',
    type: 'name',
    transformer: (prop) => {
      return mappings[prop.name] || prop.name
    },
  })

  InternalApi.extend(
    createStyleDictionaryConfig({
      platform: 'common',
      sources: ['tokens.json'],
      entry: 'default',
      output: config.output,
    }),
  ).buildAllPlatforms()

  const data = []

  for (const key in config.output) {
    const buildPath = config.output[key].buildPath
    for await (const file of glob(buildPath)) {
      const localFileName = join(buildPath, basename(file))
      const extension = extname(file).replace(/^./, '')
      const content = readFileSync(file, 'utf-8')
      data.push({ fileName: localFileName, language: extension, content })
    }
  }

  return data
}
