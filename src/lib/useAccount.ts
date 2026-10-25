import { useEffect, useState } from 'react'
import { getAccountState, initAccount, subscribeAccount, type AccountState } from './account'

/**
 * Starts the non-blocking auth bootstrap on first use and mirrors the
 * account state into React. Never suspends — the state simply upgrades
 * from 'guest' when Supabase answers.
 */
export function useAccount(): AccountState {
  const [account, setAccount] = useState<AccountState>(getAccountState)

  useEffect(() => {
    initAccount()
    return subscribeAccount(setAccount)
  }, [])

  return account
}
