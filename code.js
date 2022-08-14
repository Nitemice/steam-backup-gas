const apiUrl = "http://api.steampowered.com/";
const profileUrl = "https://steamcommunity.com/id/";

///////////////////////////////////////////////////////////

function getData(url)
{
    var options = {
        "muteHttpExceptions": true,
        "followRedirects": true
    };
    var response = UrlFetchApp.fetch(url, options);
    return response.getContentText();
}

function getUserId()
{
    const idUrl = apiUrl + "ISteamUser/ResolveVanityURL/v0001/?key=" + config.apiKey +
        "&vanityurl=" + config.username;
    var data = getData(idUrl);
    data = JSON.parse(data);
    return data.response.steamid;
}

function backupProfile()
{
    // Retrieve profile from API
    var userId = getUserId();
    const profileUrl = apiUrl + "ISteamUser/GetPlayerSummaries/v0002/?key=" +
        config.apiKey + "&steamids=" + userId;

    var outputData = getData(profileUrl);
    outputData = JSON.parse(outputData);

    // Save as a json file in the indicated Google Drive folder
    common.updateOrCreateFile(config.backupDir, config.username + ".json",
        JSON.stringify(outputData.response, null, 4));
}

function backupPlaytime()
{
    // Retrieve page w/ playtimes
    const playtimeUrl = profileUrl + config.username + "/games/?tab=all&sort=name";
    var playtimePage = getData(playtimeUrl);

    // Parse page for game data
    var playtimeData = playtimePage.match(/var rgGames = (.*);/);
    if (playtimeData.length < 2)
    {
        throw "Failed to fetch valid Steam play times page.";
    }

    // Remove some fields we don't care about
    var outputData = JSON.parse(playtimeData[1]);

    outputData = outputData.map(element =>
    {
        delete element.availStatLinks;
        return element
    });

    // Save as a json file in the indicated Google Drive folder
    common.updateOrCreateFile(config.backupDir, "playtime.json",
        JSON.stringify(outputData, null, 4));
}

function backupWishlist()
{
    // Retrieve wishlist data
    var userId = getUserId();
    const wishlistUrl = "https://store.steampowered.com/wishlist/profiles/" +
        userId + "/wishlistdata/?p=";


    // Retrieve pages until no data returned
    var outputData = {};
    var p = 0;
    do
    {
        var data = getData(wishlistUrl + p);
        data = JSON.parse(data);
        outputData = {
            ...outputData,
            ...data
        };
        p++;
    } while (data.length < 1);

    // Remove some fields we don't care about
    for (const key in outputData)
    {
        delete outputData[key].screenshots;
        delete outputData[key].subs;
        delete outputData[key].platform_icons;
    };

    // Save as a json file in the indicated Google Drive folder
    common.updateOrCreateFile(config.backupDir, "wishlist.json",
        JSON.stringify(outputData, null, 4));
}

function main()
{
    backupProfile();
    backupPlaytime();
    backupWishlist();
}