// const { Analysis, Account, Utils } = require('@tago-io/sdk')
// const axios = require('axios')
// const { csv2jsonAsync } = require('json-2-csv')


import { queue } from "async";
import axios from "axios";
import { csv2json } from "json-2-csv";

import { Analysis, Resources, Services, Utils } from "@tago-io/sdk";
import { Data, TagoContext } from "@tago-io/sdk/lib/types";

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
    // delimiter: {
    //   field: ";"
    // },
    trimFieldValues: true,
    trimHeaderFields: true
  }
  const result = await csv2json(data_csv, options)
  return result.map((item) => fixKeys(item))
}

interface ICreateDevice {
  context: TagoContext
  device: any
  index: number
  connector: string
  network: string
}

// Create the device.
async function createDevice({ context, device, index, connector, network }: ICreateDevice) {
  if (!device.devicename) {
    throw console.log(`Missing devicename, line ${index}`)
  } else if (!connector) {
    throw console.log(`Missing connector, line ${index}`)
  } else if (!network) {
    throw console.log(`Missing network, line ${index}`)
  } else if (!device.deviceserial) {
    throw console.log(`Missing deviceserial, line ${index}`)
  } else if (!device.devicetype) {
    throw console.log(`Missing devicetype, line ${index}`)
  } else if (device.type === "immutable" && !device.chunkperiod) {
    throw console.log(`Missing chunkperiod, line ${index}`)
  } else if (device.type === "immutable" && !device.chunkretention) {
    throw console.log(`Missing chunkretention, line ${index}`)
  }

  await Resources.devices
    .create({
      name: device.devicename,
      connector,
      network,
      type: device.devicetype,
      chunk_period: device.chunkperiod,
      chunk_retention: device.chunkretention,
      serie_number: String(device.deviceserial),
      // tags: [{ key: "serial", value: device.deviceserial || "" }],
    })
    .then(() => {
      console.log(`Line ${index}: ${device.devicename} successfully created.`)
    })
    .catch(e => {
      const notificationService = new Services({ token: context.token }).Notification
      notificationService.send({
        title: "Error creating devices",
        message: `Bulk upload - Line ${index}: ${device.devicename} ${e}.`
      })
    })
}

// Starting function for the analysis
async function startAnalysis(context: TagoContext, scope: Data[]) {
  console.log('Starting analysis')
  // console.log('SCOPE:', JSON.stringify(scope, null, 4))

  if (!scope) {
    return console.log('This analysis must be triggered by an Input Form on a Dashboard.')
  }

  // Get the environment variables from TagoIO Analysis.
  const environment = Utils.envToJson(context.environment)
  if (!environment.account_token) {
    throw console.log('Missing account_token in Environment Variables')
  }

  // Get the bulk import form data.
  const csvFormVariable = scope.find(x => x.variable === 'csv_file' && x.metadata)
  const connector = scope.find(x => x.variable === 'connector_id')?.value as string
  const network = scope.find(x => x.variable === 'network_id')?.value as string

  const fileUrl = csvFormVariable.metadata.file.url

  if (!csvFormVariable) {
    throw console.log('No file to upload. Please upload a file to csv_file variable')
  }

  // Get the CSV file.
  const csv = await axios
    .get(fileUrl)
    .then((res) => res.data)
    .catch(e => {
      throw console.log(e.message)
    })

  // Convert the CSV file to JSON.
  const csvJson = await convertCSV(csv)
  if (!csvJson) {
    return
  }

  // Get the list of devices.
  const deviceList = await Resources.devices.list({
    // page: 1, 
    fields: ['id', 'name'],
    filter: {},
    amount: 9999
  })

  // Create the queue.
  const createDeviceQueue = await queue(createDevice, 10)
  createDeviceQueue.error((err) => console.log(err))

  for (const [i, device] of csvJson.entries()) {
    const index = i + 2

    if (deviceList.find(x => x.name === device.devicename)) {
      continue
    }

    createDeviceQueue.push({ context, index, device, connector, network })
  }

  await createDeviceQueue.drain()
  console.log("Analysis finished")
}

if (process.env.T_ANALYSIS_TOKEN) {
  Analysis.use(startAnalysis, { token: process.env.T_ANALYSIS_TOKEN });
}
