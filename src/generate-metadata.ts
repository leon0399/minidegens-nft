import fs from 'fs/promises'
import path from 'path'

const generateTokenMetadata = (n: number, metadata: { cid: string, name: string }) => ({
    name: `${metadata.name} #${n}`,
    image: `ipfs://${metadata.cid}/${n}.png`,
    attributes: [
        {
            trait_type: "AI",
            value: "DALL-E Mini"
        }
    ]
})

const generateCollectionMetadata = async () => {
    const cid = process.argv.slice(2)[0]
    const files = await fs.readdir(path.join(__dirname, '../images'))

    files.forEach(async (file) => {
        const tokenId = +(path.parse(file).name)
        const metadataContents = generateTokenMetadata(tokenId, { cid, name: 'Mini DeGen'})
        await fs.writeFile(path.join(__dirname, `../metadata/${tokenId}.json`), JSON.stringify(metadataContents, undefined, 2))
    });
}

generateCollectionMetadata()