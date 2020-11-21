import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

test('test runs', () => {
    process.env['INPUT_LIST'] = '__tests__/list*.*'
    const ip = path.join(__dirname, '..', 'lib', 'main.js')
    const options: cp.ExecSyncOptions = {
        env: process.env
    }

    if (!fs.existsSync('./temp')) {
        fs.mkdirSync('./temp')
    }

    console.log(cp.execSync(`node ${ip}`, options).toString())
})
