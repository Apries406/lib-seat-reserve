import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'

export default function Index() {
  useLoad(() => {
    console.log('Index page loaded.')
  })

  return (
    <View className='index'>
      <View className='header'>
        <Text className='title'>自习座位</Text>
      </View>
      <View className='content'>
        <Text>座位预约系统首页</Text>
      </View>
    </View>
  )
}
