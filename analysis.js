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
    headers: {
      'Content-Type': 'text/csv'
    }
  };

  let { data } = await axios(options);
  data = data.replace(/\r/g, '');
  const json = await json2csv.csv2jsonPromisified(data);

  // just making sure template is a boolean.
  return json.map(x => ({ ...x, template: x.template === 'true' }));
}

// Starting function for the analysis
async function initAnalysis(context, scope) {
  if (!scope) return context.log('No scope to run');

  // Get the environment variables from TagoIO Analysis.
  const env_vars = TagoUtils.env_to_obj(context.environment);
  if (!env_vars.acc_token) throw context.log('Missing acc_token in Environment Variables');

  let file;
  let index;
  // Get the variables from the Form.
  if (scope[0].index) {
    index = scope[0].index;
    file = scope[0].file_url;
  } else {
    const var_file = scope.find(x => x.variable === 'csv_file' && x.metadata);
    if (!var_file) throw context.log('No file to upload. Please upload a file to csv_file variable');
    
    file = var_file.metadata.file.url;
  }

  // create the Tago Account object.
  const account = new TagoAccount(env_vars.acc_token);

  const csv_json = await getCSV(file).catch((e) => {
    context.log(e.message);
    return;
  });
  
  if (!csv_json) return;
  else if (index) {
    csv_json = csv_json.slice(index);
  }

  let i = 1;
  const device_list = await account.devices.list(1, ['id', 'name'], {}, 9999);

  for (const [index, device] of csv_json.entries()) {
    if ( i >= 50 ) {
      await account.analysis.run(context.analysis_id, [{
        file_url: file.metadata.file.url,
        index,
      }]).catch(context.log);
      return;
    }
    if (!device.devicename) throw context.log(`Missing devicename, line ${index}`);
    else if (!device.deviceimei) throw context.log(`Missing deviceimei, line ${index}`);

    if (device_list.find(x => x.name === device.devicename)) continue;

    // Create the device.
    await account.devices.create({
      name: device.devicename,
      serie_number: device.deviceimei,
      connector: device.connector,
      // tags: [ { key: device.key, value: device.tag }],
    }).then(() => { context.log(`Line ${index}: ${device.devicename} succesfully created.`); })
      .catch((e) => { context.log(`[Error] Line ${index}: ${device.devicename} ${e}.`); });
    i += 1;
  };
}

module.exports = new TagoAnalysis(initAnalysis, 'ANALYSIS-TOKEN-FOR-EXTERNAL');
