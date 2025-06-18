import {
  createUniqueUuid,
  logger,
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { takeItPrivate } from '../utils'
import { EMAIL_TYPE, SPARTAN_SERVICE_TYPE } from '../constants'

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

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charsLength = chars.length;

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }

  return result;
}

function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  return matches || [];
}

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

// handle no EMAIL_TYPE to EMAIL_TYPE transition
export const userRegistration: Action = {
  name: 'USER_REGISTRATION',
  similes: [
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    console.log('USER_REGISTRATION validate') // , message.metadata
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

    // if not a discord/telegram message, we can ignore it
    if (!message.metadata.fromId) return false

    // using the service to get this/components might be good way
    //const entityId = createUniqueUuid(runtime, message.metadata.fromId);
    const entity = await runtime.getEntityById(message.entityId)
    // all clients should handle this
    if (!entity) {
      logger.warn('USER_REGISTRATION client did not set entity')
      return false;
    }
    /*
    if (!entity) {
      entity = await runtime.createEntity({
        id: entityId,
        names: [message.metadata.entityName, message.metadata.entityUserName],
        metadata: {},
        agentId: existingAgent.id,
      });
    }
    */
    //console.log('reg:validate entity', entity)
    const email = entity.components.find(c => c.type === EMAIL_TYPE)
    //console.log('reg_start:validate - are signed up?', !!email)
    return !email
  },
  description: 'Replies with starting a user registration',
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback,
    responses: any[]
  ): Promise<boolean> => {
    console.log('USER_REGISTRATION handler')
    //console.log('message', message)

    // ok we need to change a state on this author

    // get room and it's components?
    const roomDetails = await runtime.getRoom(message.roomId);
    // doesn't have components
    console.log('roomDetails', roomDetails)
    const roomEntity = await runtime.getEntityById(message.roomId)
    console.log('roomEntity', roomEntity)

    const agentEntityId = createUniqueUuid(runtime, runtime.agentId);
    const agentEntity = await runtime.getEntityById(agentEntityId);
    console.log('agentEntity', agentEntity)
    let spartanData = agentEntity.components.find(c => c.type === SPARTAN_SERVICE_TYPE)
    let spartanDataNew = false
    let spartanDataDelta = false
    if (!spartanData) {
      // initialize
      spartanDataNew = true
      spartanData = {
        data: {
          users: [],
        }
      }
    }


    // using the service to get this/components might be good way
    //const entityId = createUniqueUuid(runtime, message.metadata.fromId);
    const entity = await runtime.getEntityById(message.entityId)
    console.log('entity', entity)
    const email = entity.components.find(c => c.type === EMAIL_TYPE)
    console.log('email', email)

    const emails = extractEmails(message.content.text)

    console.log('would have responded', responses)
    console.log('emails in message', emails.length)
    if (emails.length > 1) {
      if (email) {
        // any overlap?
        console.log('Write overlap')
      } else {
        takeItPrivate(runtime, message, 'What email address would you like to use for registration', responses)
        //responses.length = 0 // just clear them all
      }
    } else
    if (emails.length === 1) {
      console.log('spartanData', spartanData)
      const isLinking = spartanData.data.users.includes(emails[0])

      if (isLinking) {
        console.log('this email is already used else where', isLinking)
      } else {
        const regCode = generateRandomString(16)
        console.log('sending', regCode, 'to email', emails[0])
        // set this entities email
        await runtime.createComponent({
          id: uuidv4() as UUID,
          agentId: runtime.agentId,
          worldId: roomDetails.worldId,
          roomId: message.roomId,
          sourceEntityId: message.entityId,
          entityId: message.entityId,
          type: EMAIL_TYPE,
          data: {
            address: emails[0],
            code: regCode,
            verified: false,
          },
        });
        spartanDataDelta = true
        spartanData.data.users.push(message.entityId)
        await sendVerifyEmail(emails[0], regCode)
        takeItPrivate(runtime, message, 'I just sent you an email (might need to check your spam folder) to confirm ' + emails[0], responses)
        //responses.length = 0 // just clear them all
      }
      // update spartanData
      async function updateSpartanData(agentEntityId, spartanData) {
        if (spartanDataNew) {
          await runtime.createComponent({
            id: uuidv4() as UUID,
            agentId: runtime.agentId,
            worldId: roomDetails.worldId,
            roomId: message.roomId,
            sourceEntityId: message.entityId,
            entityId: agentEntityId,
            type: SPARTAN_SERVICE_TYPE,
            data: spartanData.data,
          });
        } else {
          await runtime.updateComponent({
            id: spartanData.id,
            // do we need all these fields?
            //agentId: runtime.agentId,
            //worldId: roomDetails.worldId,
            //roomId: message.roomId,
            //sourceEntityId: entityId,
            //entityId: entityId,
            //type: SPARTAN_SERVICE_TYPE,
            data: spartanData.data,
          });
        }
      }
      // if we need to update it
      if (spartanDataDelta) {
        updateSpartanData(agentEntityId, spartanData)
      }
    } else {
      // no email provided

      // we can make a component for the state of this form

      // do we have an email component already
      if (email) {
        // if so we should confirm

        // set wizard state
        // set form state
        // yes/no
        takeItPrivate(runtime, message, 'Do you want to use ' + email + ' for registration?', responses)
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
        takeItPrivate(runtime, message, 'What email address would you like to use for registration', responses)

        const isDM = roomDetails.type === 'dm'
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
        },
      },
    ],
  ] as ActionExample[][],
}