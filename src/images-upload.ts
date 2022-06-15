import fs from 'fs'
import path from 'path'
import { filesFromPath } from 'files-from-path'
import { NFTStorage, File } from 'nft.storage'

const token = process.argv.slice(2)[0]

async function main() {
    const storage = new NFTStorage({ token })

    const imagesPath = path.join(__dirname, '../images')
    const files = filesFromPath(imagesPath, { pathPrefix: imagesPath })

    const allFiles = []

    for await (const file of files) {
        allFiles.push(file)
    }

    const totalSize = allFiles.reduce((s, file) => s + file.size, 0)

    allFiles
        .sort(({ name: a }, { name: b }) => (+(path.parse(a).name)) - (+(path.parse(b).name)))

    console.log(allFiles)

    console.log(`Encoding directory: ${allFiles.length} files`)

    const { cid, car } = await NFTStorage.encodeDirectory(allFiles)

    console.log(`CID: ${cid.toString()}`)

    let storedChunks = 0
    let storedBytes = 0.00
    const startTime = Date.now()

    await storage.storeCar(car, {
        maxRetries: 100,
        onStoredChunk: (size) => {
            storedChunks++
            storedBytes += size

            const elapsedTime = Date.now() - startTime
            const percentage = storedBytes / totalSize
            const eta = new Date(Date.now() + (elapsedTime / percentage)).toISOString()

            console.log(`Chunk stored: ${storedChunks} (${storedBytes} bytes) (${percentage * 100} %) ETA: ${eta}`)
        },
        // @ts-ignore
        onFailedAttempt: (err) => {
            console.error(`Error storing chunk`, err)
        }
    })

    const status = await storage.status(cid.toString())

    console.log(`CID: ${cid.toString()} Status: ${status}`)
}

main()