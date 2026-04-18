import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'

export default function Checkin() {
  useLoad(() => {
    console.log('Checkin page loaded.')
  })

  return (
    <View className='checkin'>
      <Text>Checkin Page</Text>
    </View>
  )
}
