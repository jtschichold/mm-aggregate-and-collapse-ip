import * as core from '@actions/core'
import * as glob from '@actions/glob'

async function run(): Promise<void> {
  try {
    const lists: string = core.getInput('lists', {required: true})
    const result: string = core.getInput('result')
    const initval: string = core.getInput('initval')
    const op: string = core.getInput('op')
    const globOptions: glob.GlobOptions = {
      followSymbolicLinks:
        core.getInput('follow-symbolic-links').toUpperCase() !== 'FALSE'
    }

    const globber = await glob.create(lists, globOptions)
    for await (const file of globber.globGenerator()) {
      console.log(file)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
