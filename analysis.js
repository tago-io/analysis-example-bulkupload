const TagoAnalysis    = require('tago/analysis');
const TagoAccount     = require('tago/account');
const TagoUtils       = require('tago/utils');
const axios           = require('axios');
const json2csv        = require('json-2-csv');

// Use Axios package to get the file from the URL.
async function getCSV(url) {
  const options = {
    method: 'GET',
    url,
  };

  const { data } = await axios(options);
  const json = await json2csv.csv2jsonPromisified(data);

  // just making sure template is a boolean.
  return json.map(x => ({ ...x, template: x.template === 'true' }));
}

// Starting function for the analysis
async function initAnalysis(context, scope) {
  // Get the environment variables from TagoIO Analysis.
  const env_vars = TagoUtils.env_to_obj(context.environment);
  if (!env_vars.acc_token) throw context.log('Missing acc_token in Environment Variables');

  // Get the variables from the Form.
  const file = scope.find(x => x.variable === 'csv_file' && x.metadata);
  if (!file) throw context.log('No file to upload. Please upload a file to csv_file variable');

  // create the Tago Account object.
  const account = new TagoAccount(env_vars.acc_token);

  const csv_json = await getCSV(file.metadata.file.url);

  csv_json.forEach(async (device, index) => {
    if (!device.devicename) throw context.log(`Missing devicename, line ${index}`);
    else if (!device.deviceimei) throw context.log(`Missing deviceimei, line ${index}`);

    let connector;
    if (device.connector) {
      connector = await account.connector.info(device.connector);
      if (!connector) throw context.log(`Connector not found, line ${index}`);
    }

    // Create the device.
    await account.devices.create({
      name: device.devicename,
      serie_number: device.deviceimei,
      connector: device.connector,
      // tags: [ { key: device.key, value: device.tag }],
    }).then(() => { context.log(`Line ${index}: ${device.devicename} succesfully created.`); })
      .catch((e) => { context.log(`[Error] Line ${index}: ${device.devicename} ${e.message}.`); });
  });
}

module.exports = new TagoAnalysis(initAnalysis, 'a098fcdc-dd9b-4e7b-9f9e-ba4c8bdf1017');
