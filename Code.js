/*
  Required FOLIO permissions:
  - Users read-only permissions
*/

// const ITEM_BARCODE_COLUMN = 'D';
// const INSTANCE_UUID_COLUMN = 'K';
// const LAST_COLUMN = 'L';
// const SOURCE_ID_FOLIO = "f32d531e-df79-46b3-8932-cdd35f7a2264";
// const STATISTICAL_CODE_RETENTION_AGREEMENT = "ba16cd17-fb83-4a14-ab40-23c7ffa5ccb5";

function testGenerateReport() {
    generateReport({
      'environment': 'prod',
    //   'start_row': 2,
    //   'end_row': 6
    });
}

function onOpen() {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('FOLIO')
      	.addItem('Show Sidebar', 'showSidebar')
      	.addToUi();
}
  
function showSidebar() {  // eslint-disable-line no-unused-vars
    var html = HtmlService.createHtmlOutputFromFile('sidebar')
      .setTitle('Create Holdings and Bound-with Parts')
      .setWidth(500);
    SpreadsheetApp.getUi()
      .showSidebar(html);
}
  
function authenticate(config) {
    PropertiesService.getScriptProperties().setProperty("config", JSON.stringify(config));
    config.username = PropertiesService.getScriptProperties().getProperty("username");
    config.password = Utilities.newBlob(Utilities.base64Decode(
        PropertiesService.getScriptProperties().getProperty("password")))
        .getDataAsString();
    FOLIOAUTHLIBRARY.authenticateAndSetHeaders(config);

}

function generateReport(config) {
    let spreadsheet = SpreadsheetApp.getActiveSheet();
    var range = spreadsheet.getRange("A2:P100000");
    range.clearContent();
    range.clearFormat();

    authenticate(config);
    let permissionUsers = loadPermissionUsers();
    updateSheet(permissionUsers);
}

function loadPermissionUsers() {
    let config = JSON.parse(PropertiesService.getScriptProperties().getProperty("config"));

    // Query all users with any linked permissions object
    let permissionUsersQuery = FOLIOAUTHLIBRARY.getBaseOkapi(config.environment) + 
        // '/perms/users?limit=100000';
        '/perms/users?limit=100000';
    console.log("Loading users with query: ", permissionUsersQuery);
    let getOptions = FOLIOAUTHLIBRARY.getHttpGetOptions();
    let response = UrlFetchApp.fetch(permissionUsersQuery, getOptions);
    if (response.getResponseCode() != 200) {
        throw new Error("Cannot get permission user records, response: " + response);
    }

    // Parse response
    let responseText = response.getContentText();
    let responseObject = JSON.parse(responseText);
    let permissionUsers = responseObject.permissionUsers;
    
    if (permissionUsers == null || permissionUsers.length == 0) {
        console.error("No permission users");
        return null;
    }

    return permissionUsers;
}

  
function loadUser(permissionUser) {
    let config = JSON.parse(PropertiesService.getScriptProperties().getProperty("config"));

    // Query user
    let userQuery = FOLIOAUTHLIBRARY.getBaseOkapi(config.environment) + 
        '/users/' + permissionUser.userId;
    console.log("Loading user with query: ", userQuery);
    let getOptions = FOLIOAUTHLIBRARY.getHttpGetOptions();
    let response = UrlFetchApp.fetch(userQuery, getOptions);
    if (response.getResponseCode() != 200) {
        // throw new Error("Cannot get user record, response: " + response);
        console.error("Cannot get user record for " + permissionUser.userId + ", response: " + response);
        return null;
    }

    // Parse response
    let responseText = response.getContentText();
    let responseObject = JSON.parse(responseText);
    let user = responseObject;   
    return user;
}

function updateSheet(permissionUsers) {
    let values = [];
    let headers = getHeaders();
    values.push(headers); 
    permissionUsers.forEach(function(permissionUser, index) {
        if (permissionUser.permissions?.length > 0) {
            let userValues = getUserValues(permissionUser);
            if (userValues != null) {
                values.push(userValues);
                console.log('Found user: ' + userValues[1] + " " + userValues[2]);
            }
        }

        if (index % 1000 == 0) {
            console.log("Index " + index);
        }
    });

    let spreadsheet = SpreadsheetApp.getActiveSheet();
    spreadsheet.getRange(1, 1, values.length, headers.length).setValues(values);
}

function getHeaders() {
    return [
        'ID',
        'First',
        'Last',
        'Permissions',
    ];
}

function getUserValues(permissionUser) {
    let user = loadUser(permissionUser);
    if (user == null) {
        return null;
    }

    let userValues = [
        user.id,
        user.personal.firstName,
        user.personal.lastName,
        permissionUser.permissions,
    ];
    return userValues;
}

