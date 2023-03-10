// const { Analysis, Account, Utils } = require('@tago-io/sdk')
// const axios = require('axios')
// const { csv2jsonAsync } = require('json-2-csv')


import { Account, Analysis, Utils } from "@tago-io/sdk";
import { Data } from "@tago-io/sdk/out/common/common.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import axios from "axios";
import { csv2jsonAsync } from "json-2-csv";
import { queue } from "async";

// Fix the keys of the JSON object.
function fixKeys(item: any) {
  return Object.keys(item).reduce((final, key) => {
    const new_key = key.replaceAll(' ', '_').toLowerCase()
    final[new_key] = item[key]
    return final
  }, {} as any)
}

// Convert your CSV file to JSON.
async function convertCSV(data_csv: string) {
  const options = {
    // use delimiter ; when exporting from excel
    delimiter: {
      field: ";"
    },
    trimFieldValues: true,
    trimHeaderFields: true
  }
  const result = await csv2jsonAsync(data_csv, options)
  return result.map((item) => fixKeys(item))
}

interface ICreateDevice {
  account: Account
  context: TagoContext
  device: any
  index: number
  connector: string
  network: string
}

// Create the device.
async function createDevice({ account, context, device, index, connector, network }: ICreateDevice) {
  if (!device.devicename) {
    throw context.log(`Missing devicename, line ${index}`)
  } else if (!device.devicetype) {
    throw context.log(`Missing devicetype, line ${index}`)
  } else if (device.type === "immutable" && !device.chunkperiod) {
    throw context.log(`Missing chunkperiod, line ${index}`)
  } else if (device.type === "immutable" && !device.chunkretention) {
    throw context.log(`Missing chunkretention, line ${index}`)
  }

  await account.devices
    .create({
      name: device.devicename,
      connector,
      network,
      type: device.devicetype,
      chunk_period: device.chunkperiod,
      chunk_retention: device.chunkretention,

      // tags: [ { key: device.key, value: device.tag }],
    })
    .then(() => {
      context.log(`Line ${index}: ${device.devicename} successfully created.`)
    })
    .catch(e => {
      context.log(`[Error] Line ${index}: ${device.devicename} ${e}.`)
    })
}

// Starting function for the analysis
async function startAnalysis(context: TagoContext, scope: Data[]) {
  console.log('startAnalysis')
  console.log('SCOPE:', JSON.stringify(scope, null, 4))

  if (!scope) {
    return context.log('No scope to run')
  }

  // Get the environment variables from TagoIO Analysis.
  const environment = Utils.envToJson(context.environment)
  if (!environment.account_token) {
    throw context.log('Missing account_token in Environment Variables')
  }

  // Create the Tago Account object.
  const account = new Account({ token: environment.account_token })

  // Get the bulk import form data.
  const csvFormVariable = scope.find(x => x.variable === 'csv_file' && x.metadata)
  const connector = scope.find(x => x.variable === 'connector' && x.metadata)?.value as string
  const network = scope.find(x => x.variable === 'network' && x.metadata)?.value as string

  const fileUrl = csvFormVariable.metadata.file.url

  if (!csvFormVariable) {
    throw context.log('No file to upload. Please upload a file to csv_file variable')
  }

  // Get the CSV file.
  const csv = await axios
    .get(fileUrl)
    .then((res) => res.data)
    .catch(e => {
      throw context.log(e.message)
    })

  // Convert the CSV file to JSON.
  const csvJson = await convertCSV(csv)
  if (!csvJson) {
    return
  }

  // Get the list of devices.
  const deviceList = await account.devices.list({
    // page: 1, 
    fields: ['id', 'name'],
    filter: {},
    amount: 9999
  })

  // Create the queue.
  const createDeviceQueue = await queue(createDevice, 10)
  createDeviceQueue.error((err) => console.log(err))

  for (const [i, device] of csvJson.entries()) {
    const index = i + 1

    if (deviceList.find(x => x.name === device.devicename)) {
      continue
    }

    createDeviceQueue.push({ account, context, index, device, connector, network })
  }

  await createDeviceQueue.drain()
  console.log("Analysis finished")
}

if (process.env.T_ANALYSIS_TOKEN) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}
