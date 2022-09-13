import { NearBindgen, near, call, view, initialize, UnorderedMap } from 'near-sdk-js'
import { assert } from './utils'
import { Donation as Payment, STORAGE_COST } from './model'

@NearBindgen({})
class PaymentsContract {
  recipient: string = "v1.faucet.nonofficial.testnet";
  payments: UnorderedMap = new UnorderedMap('map-uid-1');

  @initialize({})
  init({ beneficiary: recipient }:{beneficiary: string}) {
    this.recipient = recipient
  }

  @call({payableFunction: true})
  donate() {
    // Get who is calling the method and how much $NEAR they attached
    let payer = near.predecessorAccountId(); 
    let paymentAmount: bigint = near.attachedDeposit() as bigint;

    let paidSoFar = this.payments.get(payer) === null? BigInt(0) : BigInt(this.payments.get(payer) as string)
    let toTransfer = paymentAmount;
 
    // This is the user's first donation, lets register it, which increases storage
    if(paidSoFar == BigInt(0)) {
      assert(paymentAmount > STORAGE_COST, `Attach at least ${STORAGE_COST} yoctoNEAR`);

      // Subtract the storage cost to the amount to transfer
      toTransfer -= STORAGE_COST
    }

    // Persist in storage the amount donated so far
    paidSoFar += paymentAmount
    this.payments.set(payer, paidSoFar.toString())
    near.log(`Thank you ${payer} for paying ${paymentAmount}! You paid a total of ${paidSoFar}`);

    // Send the money to the beneficiary
    const promise = near.promiseBatchCreate(this.recipient)
    near.promiseBatchActionTransfer(promise, toTransfer)

    // Return the total amount donated so far
    return paidSoFar.toString()
  }

  @call({privateFunction: true})
  change_beneficiary(recipient) {
    this.recipient = recipient;
  }

  @view({})
  get_payer(){ return this.recipient }

  @view({})
  number_of_payers() { return this.payments.length }

  @view({})
  get_payments({from_index = 0, limit = 50}: {from_index:number, limit:number}): Payment[] {
    let ret:Payment[] = []
    let end = Math.min(limit, this.payments.length)
    for(let i=from_index; i<end; i++){
      const account_id: string = this.payments.keys.get(i) as string
      const payment: Payment = this.get_payment_for_account({account_id})
      ret.push(payment)
    }
    return ret
  }

  @view({})
  get_payment_for_account({account_id}:{account_id:string}): Payment{
    return new Payment({
      account_id,
      total_amount: this.payments.get(account_id) as string
    })
  }
}