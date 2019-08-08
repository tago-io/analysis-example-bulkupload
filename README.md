## What this script does
Allows you to use a TagoIO Form Widget in a Dashboard to upload a CSV with device details to be created. Allowing you to upload a bulk of devices in a few seconds.

This analysis uses an external package called json-2-csv. Because of that you must compile it with tago-builder before uploading to your analysis on TagoIO. More informations bellow.

## How to run the script
* You can import the compiled file through this [analysis template](). Or follow the instructions on "How to Build the Analysis".
* With the analysis in your account, you must go to the Environment Variables section of the analysis.
* Change the "Your Account Token Here" field to an account token of your account. You can generate a account token by going to the [My Accounnt](https://admin.tago.io/account) page, selecting your profile and going to the "Token" section.
* Save the Analysis.
* Create a HTTP Device with name "Bulk Upload" to use with the dashboard later.
* Import this [dashboard template](http://admin.tago.io/template/5d4c6ddd9723f8001b9395b4).
* Replace the Devices for the one you created.
* Edit the Widget, enter User Control section and change the analysis to the analysis you imported.

Now you can upload your CSV to the form. Here is a [CSV example](https://raw.githubusercontent.com/tago-io/analysis-example-bulkupload/master/example.csv).

In order to get the Connector for the CSV, you must enter the [Device creation page](https://admin.tago.io/devices/connectors) and select the connector you desire. You can copy the ID from the URL of the page: https://admin.tago.io/devices/connectors/**5d1f963eeadd0b001bc91d0d**.

## How to Build the Analysis
* Download this repository.
* Open [Node.js Installation Guide](https://nodejs.org/en/download/package-manager/) for instructions on how to install NPM and Node.js.
* Open your favorite command-line tool like the Windows Command Prompt, PowerShell, Cygwin, Bash or the Git shell (which is installed along with Github for Windows). Then create or navigate to your new project folder.
* Now you must install Tago SDK. Enter in your command-line `npm install`. This will start the installation of the TagoIO SDK.
* Enter in your command-line `tago-builder analysis.js` to generate the analysis.tago.js.
* Create an Analysis on your TagoIO account.
* Upload the analysis.tago.js