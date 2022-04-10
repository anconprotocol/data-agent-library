const { Crypto } = require('@peculiar/webcrypto')
const crypto = new Crypto()
// @ts-ignore
if (!global.window) {
  global.crypto = crypto
}
import { Waku, WakuMessage } from 'js-waku'
import { Codec } from 'multiformats/bases/base'
import { BlockCodec, ByteView } from 'multiformats/codecs/interface'
import { map, Observable, Subject, tap } from 'rxjs'
import { ChannelCodeEnum } from '../interfaces/BlockCodec'
import { BlockValue } from '../interfaces/Blockvalue'
import { ChannelTopic } from '../interfaces/ChannelTopic'
import { PubsubTopic } from '../interfaces/PubsubTopic'
import { ethers } from 'ethers'
import * as sigUtil from '@metamask/eth-sig-util'
import {
  PacketPayload,
  PublicKeyMessage,
  SecurePacketPayload,
} from '../interfaces/PublicKeyMessage'
import { SignTypedDataVersion } from '@metamask/eth-sig-util'
import { arrayify } from 'ethers/lib/utils'
import { StorageBlock } from '../interfaces/StorageKind'

export interface IMessaging {
  bootstrap(options: any): void
}

export interface ChannelOptions {
  from?: string
  sigkey?: Uint8Array
  pubkey?: Uint8Array
  canPublish?: boolean
  canSubscribe?: boolean
  blockCodec: BlockCodec<any, unknown>
  middleware: {
    incoming: Array<(a: Observable<any>) => Observable<unknown>>
    outgoing: Array<(a: Observable<any>) => Observable<unknown>>
  }
}

export class MessagingService implements IMessaging {
  // @ts-ignore
  waku: Waku

  constructor(
    private web3Provider: any,
    private pubkey: string,
    private pubkeySig: string,
    private defaultAddress: string,
  ) {}

  async load(key: any, data: any): Promise<any> {}

  async bootstrap(options: any) {
    const config = options || { bootstrap: { default: true } }
    this.waku = await Waku.create(config)
    const available = await this.waku.waitForRemotePeer()
    return { waku: this.waku, connected: available }
  }

  async signEncryptionKey(
    appName: string,
    encryptionPublicKeyHex: string,
    ownerAddressHex: string,
    providerRequest: (request: {
      method: string
      from: string
      params?: Array<any>
    }) => Promise<any>,
  ): Promise<string> {
    const msgParams = this.buildMsgParams(
      appName,
      encryptionPublicKeyHex,
      ownerAddressHex,
    )

    return providerRequest({
      method: 'eth_signTypedData_v4',
      params: [ownerAddressHex, msgParams],
      from: ownerAddressHex,
    })
  }

  buildBlockDocument(topicDomainName: string, storageBlock: StorageBlock) {
    return JSON.stringify({
      domain: {
        name: topicDomainName,
        version: '1',
      },
      message: {
        ...storageBlock,
      },
      primaryType: 'StorageBlock',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
        ],
        StorageAsset: [
          { name: 'name', type: 'string' },
          { name: 'kind', type: 'string' },
          { name: 'timestamp', type: 'number' },
          { name: 'description', type: 'string' },
          { name: 'image', type: 'string' },
          { name: 'sources', type: 'string[]' },
          { name: 'owner', type: 'string' },
        ],
        StorageBlock: [
          { name: 'content', type: 'StorageAsset' },
          { name: 'kind', type: 'string' },
          { name: 'timestamp', type: 'string' },
          { name: 'issuer', type: 'string' },
        ],
      },
    })
  }

  buildMsgParams(
    topicDomainName: string,
    encryptionPublicKeyHex: string,
    ownerAddressHex: string,
  ) {
    return JSON.stringify({
      domain: {
        name: topicDomainName,
        version: '1',
      },
      message: {
        message:
          'By signing this message you certify that messages addressed to `ownerAddress` must be encrypted with `encryptionPublicKey`',
        encryptionPublicKey: encryptionPublicKeyHex,
        ownerAddress: ownerAddressHex,
      },
      primaryType: 'PublishEncryptionPublicKey',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
        ],
        PublishEncryptionPublicKey: [
          { name: 'message', type: 'string' },
          { name: 'encryptionPublicKey', type: 'string' },
          { name: 'ownerAddress', type: 'string' },
        ],
      },
    })
  }

  validatePublicKeyMessage(domainName: string, msg: PublicKeyMessage): boolean {
    const recovered = sigUtil.recoverTypedSignature({
      data: JSON.parse(
        this.buildMsgParams(
          domainName,
          msg.encryptionPublicKey,
          msg.ethAddress,
        ),
      ),
      signature: msg.signature,
      version: SignTypedDataVersion.V4,
    })

    return recovered === msg.ethAddress
  }

  /**
   * Creates a pubsub topic. Note topic format must be IPLD dag-json or dag-cbor
   * @param topic
   * @param options
   * @param blockPublisher
   * @returns
   */
  async createTopic(
    topic: string,
    options: ChannelOptions,
    privateKey: string,
    encPublicKey: string,
  ): Promise<PubsubTopic> {
    this.waku.addDecryptionKey(privateKey)
    let pub = new Subject<BlockValue>()
    let pub$
    if (options.middleware && options.middleware.outgoing) {
      pub$ = pub.pipe(
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        ...options.middleware.outgoing,
      )
    }

    // Topic subscriber observes for DAG blocks (IPLD as bytes)
    let pubsub = new Subject<any>()
    if (options.canSubscribe) {
      this.waku.relay.addObserver(
        (msg: any) => {
          let message = options.blockCodec.decode(msg.payload) as PacketPayload
          if (this.pubkey && this.defaultAddress && this.web3Provider) {
            message = options.blockCodec.decode(
              msg.payload,
            ) as SecurePacketPayload
          }
          if (msg.contentTopic === topic) {
            pubsub.next({ message: msg, decoded: message })
          }
        },
        [topic],
      )
    }

    let onBlockReply$ = pubsub.asObservable()
    if (options.middleware && options.middleware.incoming) {
      onBlockReply$ = pubsub
        .asObservable()
        .pipe(
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          ...options.middleware.incoming,
        )
    }

    // Topic publisher observes for block publisher and sends these blocks with Waku P2P
    let cancel: { unsubscribe: () => void }

    if (options.canPublish) {
      // @ts-ignore
      cancel = pub$.subscribe(async (block: BlockValue) => {
        if (block.topic !== topic) return
        let message: any = { payload: block.document }
        if (this.pubkey && this.defaultAddress && this.web3Provider) {
          const msg = this.buildBlockDocument(
            'data.universal',
            block.document as any,
          )

          const sig = await this.web3Provider.provider.send({
            method: 'eth_signTypedData_v4',
            params: [this.defaultAddress, msg],
            from: this.defaultAddress,
          })
          const pubkeyMessage = {
            signature: sig,
            ethAddress: this.defaultAddress,
            encryptionPublicKey: this.pubkey,
          } as PublicKeyMessage

          message = {
            payload: {
              ...block.document,
              signature: sig,
            },
            publicKeyMessage: pubkeyMessage,
          } as SecurePacketPayload
        }

        const packed = await options.blockCodec.encode(message)
        const msg = await WakuMessage.fromBytes(packed, topic, {
          encPublicKey: arrayify(encPublicKey),
          // sigPrivKey: arrayify('0x' + privateKey),
        })
        await this.waku.relay.send(msg)
      })
    }
    return {
      onBlockReply$,
      publish: (block: any) => pub.next(block),
      close: () => {
        if (cancel) {
          cancel.unsubscribe()
        }
      },
    }
  }

  /**
   * Creates a data channel, is similar to a pubsub topic but used for data messaging exchanges
   * @param topic
   * @param options
   * @param blockPublisher
   * @returns
   */
  async createChannel(
    topic: string,
    options: ChannelOptions,
    blockPublisher: Subject<BlockValue>,
  ): Promise<ChannelTopic> {
    // Topic subscriber observes for DAG blocks (IPLD as bytes)
    const pubsub = new Subject<any>()
    this.waku.relay.addObserver(
      (msg: any) => {
        if (options.middleware) {
          pubsub.next(msg)
        }
      },
      [topic],
    )

    // Topic publisher observes for block publisher and sends these blocks with Waku P2P
    const cancel = blockPublisher
      .pipe(
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        tap(),
        ...options.middleware.outgoing,
      )
      .subscribe(async (block: any) => {
        const view = await options.blockCodec.encode(block)
        const msg = await WakuMessage.fromBytes(view, topic, {
          //  encPublicKey: options.pubkey,
          // sigPrivKey: options.sigkey,
        })
        await this.waku.relay.send(msg)
      })

    return {
      onBlockReply$: pubsub
        .asObservable()
        .pipe(
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          map(options.blockCodec.decode),
          ...options.middleware.incoming,
        ),
      close: () => {
        if (cancel) cancel.unsubscribe()
      },
    }
  }

  /**
   * Aggregates multiple topics
   * @param topics
   * @param options
   * @param blockPublisher
   * @returns
   */
  async aggregate(
    topics: string[],
    options: ChannelOptions,
  ): Promise<ChannelTopic> {
    // Topic subscriber observes for DAG blocks (IPLD as bytes)
    const pubsub = new Subject<any>()
    this.waku.relay.addObserver((msg: any) => {
      if (options.middleware) {
        pubsub.next(msg)
      }
    }, topics)

    return {
      onBlockReply$: pubsub
        .asObservable()
        .pipe(
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          tap(),
          map(options.blockCodec.decode),
          ...options.middleware.incoming,
        ),
      close: () => {
        // no op
      },
    }
  }
}
