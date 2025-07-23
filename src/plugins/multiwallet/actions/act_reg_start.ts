import {
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type ActionExample,
  type UUID,
  createUniqueUuid,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { takeItPrivate, HasEntityIdFromMessage, getEntityIdFromMessage, extractEmails, getDataFromMessage, generateRandomString } from '../../autonomous-trader/utils'
import CONSTANTS from '../../autonomous-trader/constants'

// Create an SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,      // e.g. smtp.gmail.com, smtp.mailgun.org
  port: parseInt(process.env.SMTP_PORT) || 587,                     // 587 for TLS, 465 for SSL
  secure: false,                 // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USERNAME,       // your SMTP username
    pass: process.env.SMTP_PASSWORD        // your SMTP password or app password
  }
});

async function sendVerifyEmail(address, regCode) {
  console.log('sending verify email to', address)
  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: address,
    subject: 'Welcome to Spartan Services',
    //text: 'Please click the following link to verify you are the owner of this email and continue registration'
    text: 'Please give Spartan the following code: ' + regCode
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.envelope);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// handle no COMPONENT_USER_TYPE to COMPONENT_USER_TYPE component transition
export const userRegistration: Action = {
  name: 'USER_REGISTRATION',
  similes: [
  ],
  description: 'Replies with starting a user registration.' + CONSTANTS.DESCONLYCALLME,
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    //console.log('USER_REGISTRATION validate') // , message.metadata
/*
sve:validate message {
  id: "1e574bcc-7d3d-04de-bb2e-a58ec153832f",
  entityId: "36ab9481-0939-0d2e-be06-f2ba5bf3a917",
  agentId: "479233fd-b0e7-0f50-9d88-d4c9ea5b0de0",
  roomId: "c8936fc3-f950-0a59-8b19-a2bd342c0cb8",
  content: {
    text: "x@y.cc",
    attachments: [],
    source: "discord",
    url: "https://discord.com/channels/@me/1366955975667482685/1372702486644916354",
    inReplyTo: undefined,
  },
  metadata: {
    entityName: "Odilitime",
    fromId: "580487826420793364",
  },
  createdAt: 1747348176395,
  embedding: [],
  callback: [AsyncFunction: callback],
  onComplete: undefined,
}
*/
    //console.log('sve:validate message', message)

    if (!await HasEntityIdFromMessage(runtime, message)) {
      console.warn('USER_REGISTRATION validate - author not found')
      return false
    }

    const reg = await getDataFromMessage(runtime, message)
    //console.log('USER_REGISTRATION reg', reg)
    if (reg) {
      //console.warn('Already registration, returning false')
      return false; // require no regisration
    }

    //console.log('reg_start:validate - are signed up?', !!email)
    return true
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('USER_REGISTRATION handler')
    //console.log('message', message)

    // ok we need to change a state on this author

    // get room and it's components?
    const roomDetails = await runtime.getRoom(message.roomId);
    // doesn't have components
    //console.log('roomDetails', roomDetails)

    const componentData = await getDataFromMessage(runtime, message)
    console.log('user component', componentData)

    const emails = extractEmails(message.content.text)
    console.log('emails in message', emails.length)

    //console.log('would have responded', responses)
    if (emails.length > 1) {
      // provided multiple email addresses
      if (componentData) {
        // any overlap?
        console.log('Write overlap')
      } else {
        const content = takeItPrivate(runtime, message, 'What email address would you like to use for registration')
        callback(content)
        //responses.length = 0 // just clear them all
      }
    } else
    if (emails.length === 1) {
      //console.log('spartanData', spartanData)
      // are emails[0] signup component
      // but searching ids in spartan...
      // email list or entityid of link entity
      const emailAddr = emails[0]
      //const emailEntityId = createUniqueUuid(runtime, emailAddr);

      // always prove they really do have access to this email
      //const isLinking = spartanData.data.users.includes(emailEntityId)
      const regCode = generateRandomString(CONSTANTS.useCodeLength)
      console.log('sending', regCode, 'to email', emailAddr)

      const entityId = await getEntityIdFromMessage(runtime, message)
      console.log('entityId', entityId)
      // set this entities email
      await runtime.createComponent({
        id: uuidv4() as UUID,
        agentId: runtime.agentId,
        worldId: roomDetails.worldId,
        roomId: message.roomId,
        sourceEntityId: message.entityId,
        entityId,
        type: CONSTANTS.COMPONENT_USER_TYPE,
        data: {
          address: emailAddr,
          code: regCode,
          verified: false,
        },
      });

      await sendVerifyEmail(emailAddr, regCode)
      //responses.length = 0 // just clear them all
      const content = takeItPrivate(runtime, message, 'I just sent you an email (might need to check your spam folder) to confirm ' + emailAddr)
      callback(content)
      //}
    } else {
      // no email provided

      // we can make a component for the state of this form

      // do we have an email component already
      if (componentData) {
        // if so we should confirm

        // set wizard state
        // set form state
        // yes/no
        const content = takeItPrivate(runtime, message, 'Do you want to use ' + componentData.address + ' for registration?')
        // FIXME: won't take a yes/no as a response
        callback(content)
        //responses.length = 0 // just clear them all
      } else {
        // set form state
        /*
        await runtime.adapter.updateEntity({
          id: entityId,
          names: [...new Set([...(entity.names || []), ...names])].filter(Boolean),
          metadata: {
            ...entity.metadata,
            [source]: {
              ...entity.metadata?.[source],
              name: name,
              userName: userName,
            },
          },
          agentId: this.agentId,
        });
        */
        const content = takeItPrivate(runtime, message, 'What email address would you like to use for registration')
        callback(content)
        // callback()

        const isDM = roomDetails.type?.toUpperCase() === 'DM'
        //console.log('isDM', isDM, roomDetails.type, roomDetails)
        if (!isDM) {
          const responseContent = {
            text: 'I\'ll DM you',
            // for the web UI
            //actions: ['REPLY'],
            attachments: [],
            inReplyTo: createUniqueUuid(runtime, message.id)
          };
          callback(responseContent)
        }

        //responses.length = 0 // just clear them all
      }
    }
  },
  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to sign up for Spartan services',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help you sign up",
          actions: ['USER_REGISTRATION'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I want to register',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "What email u wanna use",
          actions: ['USER_REGISTRATION'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'I\'d like to sign up',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "based. what email u want me to use",
          actions: ['USER_REGISTRATION'],
        },
      },
    ],    [
      {
        name: '{{name1}}',
        content: {
          text: 'cool can I sign up?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "based. what email u want me to use",
          actions: ['USER_REGISTRATION'],
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'email@email.com',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help verify your email",
          actions: ['USER_REGISTRATION'],
          options: {
              email: 'email@email.com',
          },
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'can I sign up with email@email.com',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "I'll help verify your email",
          actions: ['USER_REGISTRATION'],
          options: {
              email: 'email@email.com',
          },
        },
      },
    ],
    [
      {
        name: '{{name1}}',
        content: {
          text: 'account',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: "What email u wanna use",
          actions: ['USER_REGISTRATION'],
        },
      },
    ],
  ] as ActionExample[][],
}