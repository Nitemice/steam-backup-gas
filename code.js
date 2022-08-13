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

function backupPlaytime()
{
    // Retrieve page w/ playtimes
    var playtimeUrl = profileUrl + config.username + "/games/?tab=all&sort=name";
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

function main()
{
    backupPlaytime()
}