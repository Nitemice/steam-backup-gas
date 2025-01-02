# Steam Backup Script

*Export library and wishlist from Steam, as JSON, using Google Apps Script.*

This script can be used to automatically bulk-export information about a
Steam user's collection, with playtimes and achievements, as JSON. They are
stored in a specified Google Drive directory, where they can be easily
downloaded or shared.

**NOTE**: The user's profile and game details must be set to public.
          This option can be found under "Privacy Settings" in "Edit Profile"
          options.

## Usage

This script is designed to be run on-demand via the GAS interface, or
periodically via GAS triggers. For more info on setting up GAS triggers, see
[this Google Apps Script guide](https://developers.google.com/apps-script/guides/triggers).

To execute the script, simply run the `main()` function.

## Setup

There are two basic steps necessary to run this script.

1. [Customize your config file](#1.-Customize-your-config-file)
2. [Load the script into a new Google Apps Script project](#2.-Load-the-script-into-a-new-Google-Apps-Script-project)

### 1. Customize your config file

`config.js` should contain a single JavaScript object, used to specify all
necessary configuration information. Here's where you specify the user, as
well as the Google Drive directory to save exported files to.

An example version is provided, named `example.config.js`, which can be
renamed or copied to `config.js` before loading into the GAS project.

The basic structure can be seen below.

```js
const config = {
    "username": "<Steam username>",
    "apiKey": "<Steam Dev API Key>",
    "backupDir": "<Google Drive directory ID>",
    "removeMissingGames": <true/false>
};
```

- `username`: User ID of the Steam user whose data is being exported.
    This can be found by navigating to the user's profile page, and grabbing
    the ID from the tail of the URL.
- `apiKey`: A key for accessing the
    [Steam Web API](https://steamcommunity.com/dev). It can be found on
    [Your Steam Web API Key page](https://steamcommunity.com/dev/apikey)
    if you already have one, otherwise you will be presented with a form to
    register for one. The name used doesn't matter for this purpose.

- `backupDir`: The ID of the Google Drive directory, where exported data
    should be stored. This can be found by navigating to the folder, and
    grabbing the ID from the tail of the URL.
- `removeMissingGames`: This option will remove backed up game data files
    if the game's data is not returned by the API. This can occur if a game
    is removed from a user's library, or if the script was previously run
    during a "free weekend".

### 2. Load the script into a new Google Apps Script project

You can manually load the script into a
[new GAS project](https://www.google.com/script/start/),
by simply copying and pasting it into the editor.

Or you can use a
[tool like clasp](https://developers.google.com/apps-script/guides/clasp)
to upload it directly. For more information on using clasp, here is a
[guide I found useful](https://github.com/gscharf94/Clasp-Basics-for-Reddit).
