import fs from 'fs'
import path from 'path'
import { filesFromPath } from 'files-from-path'
import { NFTStorage, File } from 'nft.storage'

const token = process.argv.slice(2)[0]

async function main() {
    const storage = new NFTStorage({ token })

    const files = filesFromPath(path.join(__dirname, '../images'))

    const allFiles = []

    for await (const file of files) {
        allFiles.push(file)
    }

    allFiles
        .sort(({ name: a }, { name: b }) => (+(path.parse(a).name)) - (+(path.parse(b).name)))

    console.log(`Encoding directory: ${allFiles.length} files`)

    const { cid, car } = await NFTStorage.encodeDirectory(allFiles)

    console.log(`CID: ${cid.toString()}`)

    let storedChunks = 0
    let storedBytes = 0.01
    await storage.storeCar(car, {
        onStoredChunk: (size) => {
            storedChunks++
            storedBytes += size

            console.log(`Chunk stored: ${storedChunks} (${storedBytes} bytes)`)
        }
    })

    const status = await storage.status(cid.toString())

    console.log(`CID: ${cid.toString()} Status: ${status}`)
}

main()