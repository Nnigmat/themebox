import { NowRequest, NowResponse } from '@vercel/node'

import { withOptionsRequest } from '../lib/withOptionsRequest'
import { parseContent } from '../lib/parseContent'
import { enableSilentConsole } from '../lib/enableSilentConsole'
import { buildThemekit, version } from '../lib/themekit'

enum HTTP_CODE {
  BAD_REQUEST = 400,
  OK = 200,
}

function validateBodyRequest(body: any): boolean {
  return body !== undefined && body.tokens !== undefined && body.config !== undefined
}

async function build(req: NowRequest, res: NowResponse): Promise<void> {
  enableSilentConsole()

  if (!validateBodyRequest(req.body)) {
    res.status(HTTP_CODE.BAD_REQUEST).json({ error: 'Config or tokens are empty.', success: false })
    return
  }

  try {
    const tokens = parseContent(req.body.tokens.content, req.body.tokens.language)
    const mappings = parseContent(req.body.mappings, 'json')
    const config = parseContent(req.body.config, 'json')
    const data = await buildThemekit(config, tokens, mappings)

    res.status(HTTP_CODE.OK).json({ data, success: true, meta: { themekit: version } })
  } catch (error) {
    res
      .status(HTTP_CODE.BAD_REQUEST)
      .json({ error: error.message, success: false, meta: { themekit: version } })
  }
}

export default withOptionsRequest(build)
