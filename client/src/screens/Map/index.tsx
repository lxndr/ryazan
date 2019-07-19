import React, {useState, useEffect, useMemo, useRef} from 'react';
import {NavigationScreenComponent} from 'react-navigation';
import {useQuery} from 'react-apollo-hooks';
import {gql} from 'apollo-boost';
import _ from 'lodash';
import MapView, {MapViewProps, PROVIDER_GOOGLE, Region, Marker} from 'react-native-maps';
import Supercluster, { ClusterFeature } from 'supercluster';
import GeoViewport from '@mapbox/geo-viewport';
import {createTabIcon, PoiCard, Modal, PoiCardAction, ScreenHeader, Filter} from '../../components';
import {LoadingIndicator, PoiMarker, ClusterMarker} from './components';
import {messageBox} from '../../services';
import * as Types from '../../types/graphql';
import {convertToFeature, regionToBoundingBox, PoiFeature} from './utils';
import {initialMapRegion} from '../../consts';
import {Map} from './atoms';
import mapStyle from '../../../config/map-style.json';

const GET_POIS = gql`
    query($search: String!) {
        pois(
            where: {
                name_contains: $search
            }
        ) {
            id
            name
            description
            latitude
            longitude
            building
            street {
                name
            }
            photos {
                content {
                    url
                }
            }
        }
    }
`;

type MapScreenParams = {
    poiId: Types.Poi['id'],
};

export const MapScreen: NavigationScreenComponent<MapScreenParams> = ({navigation}) => {
    const [filter, setFilter] = useState<Filter>({search: '', categories: []});
    const mapRef = useRef<MapView>(null);

    const {data, loading, error} = useQuery<Types.Query>(GET_POIS, {variables: filter});
    useEffect(_.partial(messageBox.error, error), [error]);
    const pois = ((data && data.pois) || []) as Types.Poi[];

    const [currentRegion, setCurrentRegion] = useState(initialMapRegion);
    const [dimentions, setDimentions] = useState({x: 0, y: 0, width: 1, height: 1});
    const [selectedMarker, setSelectedMarker] = useState<Types.Poi | null>(null);
    const unselectMarker = () => setSelectedMarker(null);

    /* clusters */
    const features = useMemo(() => {
        const clusterer = new Supercluster<Types.Poi>();
        clusterer.load(pois.map(convertToFeature));
        const bbox = regionToBoundingBox(currentRegion);
        const viewport = GeoViewport.viewport(bbox, [dimentions.width, dimentions.height]);
        return clusterer.getClusters(bbox, viewport.zoom);
    }, [pois, currentRegion, dimentions]);

    /* hides modal window if the user moves to a different screen */
    useEffect(() => {
        const sub = navigation.addListener('willBlur', unselectMarker);
        return () => sub.remove();
    });

    /* moves the camera to a specified marker */
    useEffect(() => {
        if (!(mapRef.current && pois)) return;

        const id = navigation.getParam('poiId');
        if (!id) return;

        const marker = _.find(pois, {id});
        if (!marker) return;

        mapRef.current.animateCamera({
            center: {
                longitude: marker.longitude,
                latitude: marker.latitude,
            },
        });
    }, [pois, navigation.state.params]);

    const handleLayoutChange: MapViewProps['onLayout'] = ({nativeEvent: {layout}}) =>
        setDimentions(layout);

    const renderMarker = (feature: ClusterFeature<{}> | PoiFeature) => {
        const clusterFeature = feature as ClusterFeature<{}>;

        if (clusterFeature.properties.cluster) {
            return (
                <ClusterMarker
                    key={`cluster_${clusterFeature.id}`}
                    feature={clusterFeature}
                />
            )
        }

        const poiFeature = feature as PoiFeature;

        return (
            <PoiMarker
                key={poiFeature.properties.id}
                feature={poiFeature}
                onPress={() => setSelectedMarker(poiFeature.properties)}
            />
        )
    };

    return (
        <>
            <ScreenHeader
                filter={filter}
                onFilterChange={setFilter}
            />

            <Map
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                customMapStyle={mapStyle}
                initialRegion={initialMapRegion}
                showsUserLocation
                followsUserLocation
                onLayout={handleLayoutChange}
                onRegionChangeComplete={setCurrentRegion}
            >
                {features.map(renderMarker)}
            </Map>

            {loading && <LoadingIndicator />}

            {selectedMarker &&
                <Modal onClose={unselectMarker}>
                    <PoiCard poi={selectedMarker} action={PoiCardAction.ShowDetails} />
                </Modal>
            }
        </>
    );
};

MapScreen.navigationOptions = {
    tabBarIcon: createTabIcon('place'),
};
