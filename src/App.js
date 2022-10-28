import { useState, useEffect, useMemo } from 'react';

import {
  Box,
  RadioButtonGroup
} from 'grommet';
import { ethers } from "ethers";
//import { User,Connect,Nodes,Help,Projects,Clock } from 'grommet-icons';



import { AppContext, useAppState } from './hooks/useAppState'

import useWeb3Modal from './hooks/useWeb3Modal'
import useGraphClient from './hooks/useGraphClient';

import MainMenu from './components/MainMenu';
import Banner from './components/Banner';
import GoldListModal from './components/GoldListModal';
import Stablecoins from './components/Stablecoins';
import Staking from './components/Staking';
import DappFooter from './components/DappFooter';

import abis from "./contracts/abis";
import addresses from "./contracts/addresses";

export default function App() {

  const { state, actions } = useAppState();

  const [srg,setSrg] = useState();
  const [goldList,setGoldList] = useState();
  const [busd,setBusd] = useState();
  const [stablecoins,setStablecoins] = useState();
  const [value,setValue] = useState("Native");


  const [showSwap, setShowSwap] = useState();
  const [showStake, setShowStake] = useState();
  const [coldStaking, setColdStaking] = useState();


  const {
    provider,
    coinbase,
    netId,
    loadWeb3Modal,
    logoutOfWeb3Modal,
    user,
  } = useWeb3Modal();

  const {
    client,
    initiateClient,
    getStablecoins
  } = useGraphClient();



  useEffect(() => {
    initiateClient(netId);
  },[netId]);
  useEffect(() => {
    // Goerli

    let newSrg, newGoldList, newColdStaking, newBusd
    if (netId === 5) {
      newSrg = new ethers.Contract(addresses.srg.goerli, abis.srg, provider);
      newGoldList = new ethers.Contract(addresses.goldList.goerli, abis.goldList, provider);
      newColdStaking = new ethers.Contract(addresses.coldStaking.goerli, abis.coldStaking, provider);
    }
    // Mumbai
    if (netId === 80001) {
      newSrg = new ethers.Contract(addresses.srg.mumbai, abis.srg, provider);
      newGoldList = new ethers.Contract(addresses.goldList.mumbai, abis.goldList, provider);
      newColdStaking = new ethers.Contract(addresses.coldStaking.mumbai, abis.coldStaking, provider);

    }
    if (netId === 97) {
      newSrg = new ethers.Contract(addresses.srg.bsctestnet, abis.srg, provider);
      newGoldList = new ethers.Contract(addresses.goldList.bsctestnet, abis.goldList, provider);
      //newBusd = new ethers.Contract(addresses.busd.bsctestnet, abis.srg, provider);
      newColdStaking = new ethers.Contract(addresses.coldStaking.mumbai, abis.coldStaking, provider);
    }
    setColdStaking(newColdStaking);
    setSrg(newSrg);
    setGoldList(newGoldList);
    setBusd(newBusd);
  }, [netId]);
  useMemo(async () => {
    if(client){
      const stablecoinsResult = await getStablecoins();
      const newStablecoins = await Promise.all(
        stablecoinsResult.data.stablecoins.map(async item => {
          const contract = new ethers.Contract(item.id,abis.srg,provider);
          const name = await contract.name();
          console.log(name)
          return({
            id: item.id,
            name: name
          });
        })
      );
      setStablecoins(newStablecoins);
    }
  }, [client])


  const buyTokens = async (total) => {
    const signer = provider.getSigner();
    const goldListWithSigner = goldList.connect(signer);
    const amount = ethers.utils.parseEther(total).toString()
    let tx;
    if (value === "Native") {
      tx = await goldListWithSigner.claimTokensWithNative({
        value: amount
      });
    } else {
      const allowance = await busd.allowance(coinbase, goldList.address);
      if (amount > allowance) {
        const busdWithSigner = busd.connect(signer);
        const txApproval = await busdWithSigner.approve(goldList.address, amount);
        await txApproval.wait();
      }
      const goldListWithSigner = goldList.connect(signer);
      tx = await goldListWithSigner.claimTokensWithStable(busd.address, amount);
    }

    await tx.wait();

  }


  const stakeTokens = async (totalSRG, todalDays) => {
    const signer = provider.getSigner();
    const coldStakingWithSigner = coldStaking.connect(signer);
    const amount = ethers.utils.parseEther(totalSRG).toString()
    let tx;
    console.log(srg)
    const allowance = await srg.allowance(coinbase, coldStaking.address);
    console.log(allowance)
    if (amount > allowance) {
      const srgWithSigner = srg.connect(signer);
      const txApproval = await srgWithSigner.approve(coldStaking.address, amount);
      await txApproval.wait();
    }
    tx = await coldStakingWithSigner.stake(totalSRG, todalDays);

    await tx.wait();
  }

  const getExpectedSrg = async (total) => {
    const amount = await goldList.getAmountOfTokens(ethers.utils.parseEther(total).toString());
    return (amount.toString() / 10 ** 18);
  }

  return (
    <AppContext.Provider value={{ state, actions }}>
      <MainMenu
        coinbase={coinbase}
        loadWeb3Modal={loadWeb3Modal}
        showSwap={showSwap}
        setShowSwap={setShowSwap}
        showStake={showStake}
        setShowStake={setShowStake}
      />
      <Box pad={{ top: "xlarge", bottom: "large" }} height="large" style={{
        background: `transparent url(${require('./assets/background.png')}) 0% 0% no-repeat padding-box`,
        backgroundSize: 'cover'
      }}>
        <Banner
          netId={netId}
          srg={srg}
          goldList={goldList}
          coinbase={coinbase}
          loadWeb3Modal={loadWeb3Modal}
        />
        {
          coinbase &&
          <Box align="center" pad="medium">
            <RadioButtonGroup
              name="payment"
              options={['Native', 'Stablecoin']}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Box>
        }
        {
          coinbase &&
          stablecoins &&
          value === "Stablecoin" &&
          <Stablecoins
            provider={provider}
            stablecoins={stablecoins}
            setBusd={setBusd}
          />
        }
        {
          coinbase &&
          (
            value === "Native" ||
            (
              value === "Stablecoin" && busd
            )
          ) &&
          <GoldListModal
            value={value}
            provider={provider}
            coinbase={coinbase}
            netId={netId}
            buyTokens={buyTokens}
            getExpectedSrg={getExpectedSrg}
          />
        }
      </Box>
      {
        coinbase &&
        showStake &&
        <Staking
          stakeTokens={stakeTokens}
          setShowStake={setShowStake}
        />
      }
      <DappFooter />
    </AppContext.Provider>
  )
}
