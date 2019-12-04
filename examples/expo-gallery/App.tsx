import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Dimensions, ScrollView, Button, Platform, ProgressBarAndroid, ProgressViewIOS, SafeAreaView } from 'react-native';
import { imageStore } from './src/store';
import { URIEvent, OfflineImage } from 'react-native-async-image-store';

const images = [
  'https://images.unsplash.com/photo-1496206402647-3c79bd59c051?fm=png',
  'https://images.unsplash.com/photo-1506113814177-63bcce836922?fm=png',
  'https://images.unsplash.com/photo-1477240489935-6c96abea2aba?fm=png',
  'https://images.unsplash.com/photo-1472954253026-157558836cd2?fm=png',
  'https://images.unsplash.com/photo-1470053118841-6113c089d41f?fm=png',
  'https://images.unsplash.com/photo-1416512048579-135419d176dd?fm=png'
]

async function initialize(onProgress: (event: URIEvent, currentIndex: number, total: number) => void) {
  await imageStore.mount()
  await imageStore.preloadImages(images, onProgress)
}

function Images() {
  const width = Dimensions.get('window').width
  const height = width / 1.5
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
      {images.map((uri) => <OfflineImage reactive staleWhileRevalidate style={{ width, height }} storeName={'GoldenProject'} height={height} width={width} key={uri} source={{ uri }} />)}
    </ScrollView>
  )
}

function LoadingIndicator({ downloaded, total }: { downloaded: number, total: number }) {
  const progress = total === 0 ? 0 : downloaded / total
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'stretch', margin: 10 }}>
      <ActivityIndicator size="large" />
      <Text style={[styles.textCard, { marginVertical: 10 }]}>
        Images are being synchronized for the first time...
        It might look a bit slow, but those pictures are very big.
        Just to let you see the sync phase.
      </Text>
      {Platform.OS === 'android' ? <ProgressBarAndroid style={styles.bottomElem} styleAttr="Horizontal" indeterminate={false} progress={progress} /> : <ProgressViewIOS progress={progress} />}
    </SafeAreaView>
  )
}

function Card({ clearStore }: { clearStore: () => void }) {
  return (
    <SafeAreaView pointerEvents="auto" style={styles.cardContainer}>
      <View pointerEvents="auto" style={styles.card}>
        <Text style={styles.textCard}>
          These pictures are now assets of the application, and you have total control over their lifetime. The app has access to these while offline.
        </Text>
        <View style={styles.bottomElem}>
          <Button title="Reinitialize" onPress={clearStore} />
        </View>
      </View>
    </SafeAreaView>
  )
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [downloaded, setDownloaded] = useState(0)
  const [total, setTotal] = useState(0)
  function mountStore() {
    let numOfDl = 0
    const onProgress = (event: URIEvent, currentIndex: number, total: number) => {
      numOfDl++
      setDownloaded(numOfDl)
      setTotal(total)
    }
    initialize(onProgress).then(() => {
      setIsLoading(false)
    })
  }
  useEffect(function onStart(){
    mountStore()
    return async () => {
      return imageStore.deleteAllImages()
    }
  }, [])
  const clearStore = () => {
    setIsLoading(true)
    setDownloaded(0)
    imageStore.clear().then(mountStore)
  }
  return (
    <View style={[{ flex: 1 }, styles.container]}>
      {isLoading ? <LoadingIndicator downloaded={downloaded} total={total} /> : <Images />}
      {isLoading ? null : <Card clearStore={clearStore} />}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1, justifyContent: 'flex-end', alignItems: 'center', position: 'absolute', top: 0, bottom: 0, left: 0, right: 0
  },
  card: {
    padding: 10,
  },
  textCard: {
    fontSize: 30, padding: 10, marginVertical: 10, color: 'white', backgroundColor: 'rgba(33, 39, 48, 0.75)'
  },
  container: {
    backgroundColor: '#1d3c4f',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  bottomElem: {
    height: 30
  }
});
