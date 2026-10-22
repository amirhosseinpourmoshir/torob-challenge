import { createContext, useContext } from 'react'

export const ShoppingContext = createContext(null)
export const useShopping = () => useContext(ShoppingContext)
