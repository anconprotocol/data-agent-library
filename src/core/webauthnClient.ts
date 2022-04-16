import { base64 } from 'ethers/lib/utils'
import { Fido2Lib } from 'fido2-lib'
import { WebauthnHardwareAuthenticate } from './webauthnServer'

const base64url = require('base64url')

const { Crypto } = require('@peculiar/webcrypto')
const crypto = new Crypto()
// @ts-ignore
if (!global.window) {
  global.crypto = crypto
}

export class WebauthnHardwareClient {
  constructor(private server: WebauthnHardwareAuthenticate) {}

  async register(username: string, displayName: string) {
    try {
      const credentialCreationOptions = await this.server.registrationOptions()

      credentialCreationOptions.challenge = new Uint8Array(
        credentialCreationOptions.challenge.data,
      )
      credentialCreationOptions.user.id = new Uint8Array(
        credentialCreationOptions.user.id.data,
      )
      credentialCreationOptions.user.name = username
      credentialCreationOptions.user.displayName = displayName

      const credential: any = await navigator.credentials.create({
        publicKey: credentialCreationOptions,
      })

      const credentialId = base64.encode(credential.rawId)

      const data = {
        rawId: credentialId,
        response: {
          attestationObject: base64.encode(
            credential.response.attestationObject,
          ),
          clientDataJSON: base64.encode(credential.response.clientDataJSON),
          id: credential.id,
          type: credential.type,
        },
      }

      const registerResponse = await this.server.register({ credential: data })

      return { registerResponse, credential: data }
    } catch (e) {}
  }

  async verify(registerResponse: {publicKey: string, prevCounter: any}, userCredential: any): Promise<any> {
    try {
      const credentialRequestOptions: any = await this.server.verifyOptions()

      credentialRequestOptions.challenge = new Uint8Array(
        credentialRequestOptions.challenge.data,
      )
      credentialRequestOptions.allowCredentials = [
        {
          id: base64.encode(userCredential.rawId),
          type: 'public-key',
          transports: ['internal'],
        },
      ]

      const credential: any = await navigator.credentials.get({
        publicKey: credentialRequestOptions,
      })

      const data = {
        rawId: base64.encode(credential.rawId),
        response: {
          authenticatorData: base64.encode(
            credential.response.authenticatorData,
          ),
          signature: base64.encode(credential.response.signature),
          userHandle: base64.encode(credential.response.userHandle),
          clientDataJSON: base64.encode(credential.response.clientDataJSON),
          id: credential.id,
          type: credential.type,
        },
      }

      return this.server.verify({
        credential: data,
        prevCounter: registerResponse.prevCounter,
        publicKey: registerResponse.publicKey,
        userHandle: credential.response.userHandle,
        challenge: credentialRequestOptions.challenge,
      })

    } catch (e) {
      console.error('authentication failed', e)
    } finally {
    }
  }
}