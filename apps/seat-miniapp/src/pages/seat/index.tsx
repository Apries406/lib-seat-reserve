import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'

export default function Seat() {
  useLoad(() => {
    console.log('Seat page loaded.')
  })

  return (
    <View className='seat'>
      <Text>Seat Page</Text>
    </View>
  )
}
