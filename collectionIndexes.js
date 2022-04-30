const puppeteer = require('puppeteer');
const fsPromises = require('fs/promises');

const url = process.argv[2];

if (!url) {
    console.log(`Please enter a URL (e.g. 'npm start https://howrare.is/sharkbros').`);
    process.exit(0);
}

const collectionName = url.substring(url.lastIndexOf('/') + 1);

var numberOfPages = 27;

(async() => {
    try {
        await fsPromises.access(`${collectionName}-collection-indexes.txt`)
        await fsPromises.rm(`${collectionName}-collection-indexes.txt`);
    } catch (err) {
        console.log(err)
        console.log('error occurred while deleting old file')
    }
})();

(async() => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    let currentPageIndex = 0;

    await page.goto(`${url}/?page=${currentPageIndex}&ids=&sort_by=rank`, { waitUntil: 'load', timeout: 0 });
    await getCollectionIndexesFromCurrentPage();

    async function getCollectionIndexesFromCurrentPage() {
        const collectionIndexesElements = await page.$$('.item_stats>div:nth-child(2)>span');

        await Promise.all(
            collectionIndexesElements.map(element => {
                const collectionIndex = element.evaluate(el => el.textContent.substring(1))
                collectionIndex.then(text => fsPromises.appendFile(`${collectionName}-collection-indexes.txt`, `${text}\n`));
                return collectionIndex;
            })
        );

        currentPageIndex++;

        if (currentPageIndex < numberOfPages) {
            await switchPage(currentPageIndex);
        } else {
            await browser.close();
        }
    }

    async function switchPage(currentPageIndex) {
        await Promise.all([
            page.click(`a[href='/${collectionName}/?page=${currentPageIndex}&ids=&sort_by=rank']`),
            page.waitForNavigation({
                waitUntil: 'load',
                timeout: 0
            }),
        ]);

        await getCollectionIndexesFromCurrentPage();
    }
})();