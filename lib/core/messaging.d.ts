import { Waku } from 'js-waku';
import { BlockCodec } from 'multiformats/codecs/interface';
import { Observable, Subject } from 'rxjs';
import { BlockValue } from '../interfaces/Blockvalue';
import { ChannelTopic } from '../interfaces/ChannelTopic';
import { PubsubTopic } from '../interfaces/PubsubTopic';
import { PublicKeyMessage } from '../interfaces/PublicKeyMessage';
import { StorageBlock } from '../interfaces/StorageKind';
export interface IMessaging {
    bootstrap(options: any): void;
}
export interface ChannelOptions {
    from?: string;
    sigkey?: Uint8Array;
    pubkey?: Uint8Array;
    canPublish?: boolean;
    canSubscribe?: boolean;
    blockCodec: BlockCodec<any, unknown>;
    middleware: {
        incoming: Array<(a: Observable<any>) => Observable<unknown>>;
        outgoing: Array<(a: Observable<any>) => Observable<unknown>>;
    };
}
export declare class MessagingService implements IMessaging {
    private web3Provider;
    private pubkey;
    private pubkeySig;
    private defaultAddress;
    waku: Waku;
    constructor(web3Provider: any, pubkey: string, pubkeySig: string, defaultAddress: string);
    load(key: any, data: any): Promise<any>;
    bootstrap(options: any): Promise<{
        waku: Waku;
        connected: void;
    }>;
    signEncryptionKey(appName: string, encryptionPublicKeyHex: string, ownerAddressHex: string, providerRequest: (request: {
        method: string;
        from: string;
        params?: Array<any>;
    }) => Promise<any>): Promise<string>;
    buildBlockDocument(topicDomainName: string, storageBlock: StorageBlock): string;
    buildMsgParams(topicDomainName: string, encryptionPublicKeyHex: string, ownerAddressHex: string): string;
    validatePublicKeyMessage(domainName: string, msg: PublicKeyMessage): boolean;
    createTopic(topic: string, options: ChannelOptions, privateKey: string, encPublicKey: string): Promise<PubsubTopic>;
    createChannel(topic: string, options: ChannelOptions, blockPublisher: Subject<BlockValue>): Promise<ChannelTopic>;
    aggregate(topics: string[], options: ChannelOptions): Promise<ChannelTopic>;
}
