import React, {useEffect, useState} from 'react';
import {NavigationScreenComponent} from 'react-navigation';
import {useQuery} from 'react-apollo-hooks';
import {gql} from 'apollo-boost';
import _ from 'lodash';
import {RouteCard, createTabIcon, ScreenHeader} from '../../components';
import {messageBox} from '../../services';
import * as Types from '../../types/graphql';
import {List, Separator} from './atoms';
import {Filter, formatRouteGqlFilter} from '../../utils';

const GET_ROUTES = gql`
    query($where: JSON!) {
        routes(where: $where, sort: "name") {
            id
            name
            description
            photos {
                content {
                    provider
                    url
                }
            }
            routeitems {
                poi {
                    category {
                        id
                        name
                    }
                }
            }
        }
    }
`;

export const RoutesScreen: NavigationScreenComponent = () => {
    const [filter, setFilter] = useState<Filter>({search: '', categories: null});

    const where = formatRouteGqlFilter(filter);
    const {data, loading, refetch, error} = useQuery<Types.Query>(GET_ROUTES, {variables: {where}});
    useEffect(_.partial(messageBox.error, error), [error]);
    const routes = ((data && data.routes) || []) as Types.Route[];

    return (
        <>
            <ScreenHeader
                title="Маршруты"
                filter={filter}
                onFilterChange={setFilter}
            />

            <List<Types.Route>
                keyExtractor={item => item.id}
                renderItem={({item}) => <RouteCard route={item} />}
                ItemSeparatorComponent={Separator}
                data={routes}
                refreshing={loading}
                onRefresh={refetch}
            />
        </>
    );
};

RoutesScreen.navigationOptions = {
    tabBarIcon: createTabIcon('directions-walk'),
};
